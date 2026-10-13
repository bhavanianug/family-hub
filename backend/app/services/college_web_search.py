from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import urlparse

from openai import AsyncOpenAI

from app.core.config import settings
from app.schemas.college import CollegeResolveResponse

logger = logging.getLogger(__name__)

_AGGREGATOR_HOSTS = frozenset(
    {
        "wikipedia.org",
        "en.wikipedia.org",
        "niche.com",
        "collegetransitions.com",
        "collegevine.com",
        "cappex.com",
        "petersons.com",
        "usnews.com",
        "forbes.com",
        "reddit.com",
        "www.reddit.com",
        "commonapp.org",
        "www.commonapp.org",
        "bigfuture.collegeboard.org",
        "collegeboard.org",
        "www.collegeboard.org",
    }
)

_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")


def _client() -> AsyncOpenAI | None:
    if not settings.openai_api_key:
        return None
    return AsyncOpenAI(api_key=settings.openai_api_key)


def _normalize_url(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip().strip("`\"'")
    if not text:
        return None
    if not text.startswith(("http://", "https://")):
        text = f"https://{text}"
    parsed = urlparse(text)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return text


def _host(url: str) -> str:
    return urlparse(url).hostname.replace("www.", "").lower() if urlparse(url).hostname else ""


def _is_aggregator(url: str) -> bool:
    host = _host(url)
    if not host:
        return True
    if host in _AGGREGATOR_HOSTS:
        return True
    return any(host.endswith(f".{blocked}") for blocked in _AGGREGATOR_HOSTS)


def _score_admissions_url(url: str) -> int:
    """Higher is better for official admissions / deadlines pages."""
    if _is_aggregator(url):
        return -100
    host = _host(url)
    path = (urlparse(url).path or "").lower()
    score = 0
    if host.endswith(".edu"):
        score += 40
    if any(
        key in path
        for key in (
            "admission",
            "apply",
            "deadline",
            "freshman",
            "first-year",
            "undergraduate",
            "ugrad",
        )
    ):
        score += 25
    if "deadline" in path:
        score += 10
    if path in ("", "/"):
        score -= 5
    return score


def _pick_best_url(candidates: list[str]) -> str | None:
    scored = [( _score_admissions_url(u), u) for u in candidates if _normalize_url(u)]
    scored = [(s, u) for s, u in scored if s > -50]
    if not scored:
        return None
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return scored[0][1]


def _citations_from_response(response: Any) -> list[str]:
    urls: list[str] = []
    for item in getattr(response, "output", None) or []:
        if getattr(item, "type", None) != "message":
            continue
        for content in getattr(item, "content", None) or []:
            for ann in getattr(content, "annotations", None) or []:
                if getattr(ann, "type", None) != "url_citation":
                    continue
                url = _normalize_url(getattr(ann, "url", None))
                if url:
                    urls.append(url)
    # preserve order, drop dupes
    return list(dict.fromkeys(urls))


def _parse_json_payload(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    if not text:
        return {}
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        match = _JSON_BLOCK.search(text)
        if not match:
            return {}
        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            return {}


def parse_resolve_payload(
    *,
    college_name: str,
    output_text: str,
    citations: list[str],
) -> CollegeResolveResponse:
    warnings: list[str] = [
        "Found with OpenAI web search — confirm the link before relying on it",
    ]
    data = _parse_json_payload(output_text)
    json_url = _normalize_url(
        str(data["url"]).strip() if data.get("url") not in (None, "") else None
    )
    page_title = (
        str(data["page_title"]).strip()[:200] if data.get("page_title") else None
    )
    reason = str(data["reason"]).strip()[:300] if data.get("reason") else None
    if reason:
        warnings.append(reason)

    candidates: list[str] = []
    if json_url:
        candidates.append(json_url)
    candidates.extend(citations)

    best = _pick_best_url(candidates)
    if best and json_url and best != json_url and _is_aggregator(json_url):
        warnings.append("Preferred an official citation over an aggregator URL")

    if not best:
        warnings.append("No reliable official admissions URL found")
        return CollegeResolveResponse(
            college_name=college_name,
            url=None,
            page_title=page_title,
            citations=citations,
            warnings=warnings,
            searched=True,
        )

    return CollegeResolveResponse(
        college_name=college_name,
        url=best,
        page_title=page_title,
        citations=citations,
        warnings=warnings,
        searched=True,
    )


async def resolve_college_admissions_url(college_name: str) -> CollegeResolveResponse:
    name = college_name.strip()
    client = _client()
    if client is None:
        return CollegeResolveResponse(
            college_name=name,
            warnings=["OPENAI_API_KEY is not configured"],
            searched=False,
        )

    prompt = (
        f'Find the official undergraduate admissions page for "{name}" '
        "(prefer application dates / deadlines if available).\n"
        "Use web search. Prefer the school's own .edu (or official) site.\n"
        "Avoid aggregators (Wikipedia, Niche, College Board BigFuture, Reddit, "
        "US News, Common App marketing pages).\n"
        "Return ONLY valid JSON with this shape:\n"
        '{"url": "https://..." or null, "page_title": "..." or null, '
        '"reason": "one short sentence"}\n'
        "If no reliable official page is found, set url to null."
    )

    try:
        try:
            response = await client.responses.create(
                model=settings.openai_web_search_model,
                tools=[{"type": "web_search"}],
                tool_choice="required",
                input=prompt,
                include=["web_search_call.action.sources"],
            )
        except Exception:
            # Older API / model combos may reject include or tool_choice.
            logger.warning(
                "College web search retry without include/tool_choice for %s",
                name,
                exc_info=True,
            )
            response = await client.responses.create(
                model=settings.openai_web_search_model,
                tools=[{"type": "web_search"}],
                input=prompt,
            )
    except Exception:
        logger.exception("College web search failed for %s", name)
        return CollegeResolveResponse(
            college_name=name,
            warnings=["Web search failed — try again or paste the URL"],
            searched=False,
        )

    citations = _citations_from_response(response)
    # Also pull sources from web_search_call when include was honored
    for item in getattr(response, "output", None) or []:
        if getattr(item, "type", None) != "web_search_call":
            continue
        action = getattr(item, "action", None)
        sources = getattr(action, "sources", None) or []
        for source in sources:
            raw = (
                source.get("url")
                if isinstance(source, dict)
                else getattr(source, "url", None)
            )
            url = _normalize_url(raw if isinstance(raw, str) else None)
            if url:
                citations.append(url)
    citations = list(dict.fromkeys(citations))

    output_text = getattr(response, "output_text", None) or ""
    return parse_resolve_payload(
        college_name=name,
        output_text=output_text,
        citations=citations,
    )
