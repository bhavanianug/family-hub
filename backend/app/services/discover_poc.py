"""POC: OpenAI or Perplexity web search → candidate URLs (no page extract, no DB)."""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any
from urllib.parse import urlparse

import httpx
from openai import AsyncOpenAI

from app.core.config import settings
from app.schemas.sources import DiscoverEngineResult, ScanProposal, ScanSourceError

logger = logging.getLogger(__name__)

DEFAULT_DISCOVER_QUERY = (
    "Chicago high school teen STEM summer research internship or museum "
    "program applications open 2026 official site"
)

_MAX_URLS = 10
# Hard wall-clock budget for the whole OpenAI call (UI aborts a bit later).
_SEARCH_TIMEOUT_S = 40.0

_SKIP_HOSTS = frozenset(
    {
        "wikipedia.org",
        "en.wikipedia.org",
        "niche.com",
        "reddit.com",
        "www.reddit.com",
        "facebook.com",
        "www.facebook.com",
        "instagram.com",
        "twitter.com",
        "x.com",
        "linkedin.com",
        "www.linkedin.com",
        "youtube.com",
        "www.youtube.com",
        "tiktok.com",
        "pinterest.com",
        "quora.com",
        "collegevine.com",
        "cappex.com",
        "usnews.com",
        "forbes.com",
        "medium.com",
        "chatgpt.com",
        "openai.com",
        "immerse.education",
        "empowerly.com",
        "lumiere-education.com",
        "www.lumiere-education.com",
        "pioneeracademics.com",
        "sciteens.org",
        "scolaris.org",
        "mychimyfuture.org",
    }
)

# Perplexity Search API allows one denylist of at most 20 domains.
_PERPLEXITY_DENY_HOSTS = (
    "wikipedia.org",
    "reddit.com",
    "niche.com",
    "immerse.education",
    "empowerly.com",
    "lumiere-education.com",
    "pioneeracademics.com",
    "sciteens.org",
    "scolaris.org",
    "mychimyfuture.org",
    "medium.com",
    "quora.com",
)


def search_prompt(query: str) -> str:
    """OpenAI web-search instructions. The user's words are the ask."""
    return (
        "Find official application pages for a program a US high school or "
        f"middle school student can join.\nAsk: {query}\n\n"
        "Stay in the United States (city, metro, state, or US remote). "
        "Do not return international programs.\n"
        "Return only pages that are the program itself, on the organization's "
        "own site.\n"
        "Each bullet: program name — URL.\n\n"
        "Reject: college or graduate programs, adult or 18+ volunteer roles, "
        "programs for teachers, news articles, listicles, directories, and "
        '"top 10" roundups.\n'
        "If the page covers several programs, link the specific program, not "
        "the hub.\n"
        "If nothing qualifies, say none."
    )


def perplexity_query(query: str) -> str:
    """Perplexity has no prompt, so the constraints go in the query string."""
    return (
        f"{query} official program page Chicago high school students can apply "
        "not college not adult volunteer not teacher program"
    )


def _client() -> AsyncOpenAI | None:
    if not settings.openai_api_key:
        return None
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=_SEARCH_TIMEOUT_S,
    )


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
    path = (parsed.path or "").lower()
    if path.endswith((".pdf", ".jpg", ".png", ".gif")):
        return None
    return text.split("#")[0]


def _host(url: str) -> str:
    hostname = urlparse(url).hostname
    return hostname.replace("www.", "").lower() if hostname else ""


def _is_skipped(url: str) -> bool:
    host = _host(url)
    if not host:
        return True
    if host in _SKIP_HOSTS:
        return True
    return any(host.endswith(f".{blocked}") for blocked in _SKIP_HOSTS)


def _score_url(url: str) -> int:
    if _is_skipped(url):
        return -100
    host = _host(url)
    path = (urlparse(url).path or "").lower()
    score = 0
    if host.endswith(".edu"):
        score += 35
    if host.endswith(".gov") or ".gov." in host:
        score += 30
    if any(
        token in host
        for token in (
            "museum",
            "library",
            "parkdistrict",
            "cps.edu",
            "uic.edu",
            "northwestern",
        )
    ):
        score += 20
    if any(
        key in path
        for key in (
            "summer",
            "intern",
            "stem",
            "youth",
            "teen",
            "high-school",
            "highschool",
            "program",
            "outreach",
            "education",
        )
    ):
        score += 15
    if path in ("", "/"):
        score -= 5
    return score


def _hits_from_response(response: Any) -> list[tuple[str, str | None]]:
    """Return (url, optional title) pairs, best first."""
    hits: list[tuple[str, str | None]] = []

    for item in getattr(response, "output", None) or []:
        if getattr(item, "type", None) == "message":
            for content in getattr(item, "content", None) or []:
                for ann in getattr(content, "annotations", None) or []:
                    if getattr(ann, "type", None) != "url_citation":
                        continue
                    url = _normalize_url(getattr(ann, "url", None))
                    title = getattr(ann, "title", None)
                    if url:
                        hits.append(
                            (url, str(title).strip() if title else None)
                        )
        if getattr(item, "type", None) != "web_search_call":
            continue
        action = getattr(item, "action", None)
        sources = getattr(action, "sources", None) or []
        for source in sources:
            if isinstance(source, dict):
                raw = source.get("url")
                title = source.get("title")
            else:
                raw = getattr(source, "url", None)
                title = getattr(source, "title", None)
            url = _normalize_url(raw if isinstance(raw, str) else None)
            if url:
                hits.append(
                    (url, str(title).strip() if title else None)
                )

    text = getattr(response, "output_text", None) or ""
    for match in re.findall(r"https?://[^\s)\]\"']+", text):
        url = _normalize_url(match.rstrip(".,;"))
        if url:
            hits.append((url, None))

    best: dict[str, str | None] = {}
    for url, title in hits:
        if _score_url(url) <= -50:
            continue
        if url not in best or (title and not best[url]):
            best[url] = title

    ranked = sorted(best.items(), key=lambda pair: _score_url(pair[0]), reverse=True)
    return ranked[:_MAX_URLS]


async def discover_opportunities_poc(query: str | None = None) -> dict[str, Any]:
    q = (query or "").strip() or DEFAULT_DISCOVER_QUERY
    client = _client()
    if client is None:
        return {
            "query": q,
            "candidate_urls": [],
            "summary": None,
            "proposals": [],
            "errors": [
                ScanSourceError(
                    source_id="discover-poc",
                    source_name="Find more (POC)",
                    source_url="about:blank",
                    detail="OPENAI_API_KEY is not configured",
                )
            ],
            "llm_used": False,
        }

    prompt = search_prompt(q)

    try:
        # Plain web_search first (fast). Skip tool_choice/include — those slow nano/mini.
        response = await asyncio.wait_for(
            client.responses.create(
                model=settings.openai_web_search_model,
                tools=[{"type": "web_search"}],
                input=prompt,
            ),
            timeout=_SEARCH_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        logger.warning("Discover POC web search hit %ss wall clock", _SEARCH_TIMEOUT_S)
        return {
            "query": q,
            "candidate_urls": [],
            "summary": None,
            "proposals": [],
            "errors": [
                ScanSourceError(
                    source_id="discover-poc",
                    source_name="Find more (POC)",
                    source_url="about:blank",
                    detail=f"Web search timed out after {int(_SEARCH_TIMEOUT_S)}s — try again",
                )
            ],
            "llm_used": False,
        }
    except Exception as exc:
        logger.exception("Discover POC web search failed")
        detail = "Web search failed or timed out"
        if "timeout" in str(exc).lower():
            detail = "Web search timed out — try again"
        return {
            "query": q,
            "candidate_urls": [],
            "summary": None,
            "proposals": [],
            "errors": [
                ScanSourceError(
                    source_id="discover-poc",
                    source_name="Find more (POC)",
                    source_url="about:blank",
                    detail=detail,
                )
            ],
            "llm_used": False,
        }

    hits = _hits_from_response(response)
    summary = (getattr(response, "output_text", None) or "").strip() or None
    candidate_urls = [url for url, _title in hits]

    proposals: list[ScanProposal] = []
    for index, (url, title) in enumerate(hits):
        host = _host(url) or "page"
        proposals.append(
            ScanProposal(
                key=f"discover:{index}:{url[:80]}",
                source_id=f"discover-{index}",
                source_name=host,
                source_url=url,
                title=title or host,
                organization=None,
                description=None,
                location="Chicago, IL",
                item_url=url,
                warnings=["POC web search hit — not page-extracted"],
            )
        )

    errors: list[ScanSourceError] = []
    if not proposals:
        errors.append(
            ScanSourceError(
                source_id="discover-poc",
                source_name="Find more (POC)",
                source_url="about:blank",
                detail="Search returned no usable official URLs",
            )
        )

    return {
        "query": q,
        "candidate_urls": candidate_urls,
        "summary": summary,
        "proposals": proposals,
        "errors": errors,
        "llm_used": True,
    }


def _engine_result(engine: str, raw: dict[str, Any]) -> DiscoverEngineResult:
    return DiscoverEngineResult(
        engine=engine,
        proposals=raw["proposals"],
        errors=raw["errors"],
        llm_used=raw["llm_used"],
        candidate_urls=raw["candidate_urls"],
        summary=raw.get("summary"),
    )


def _engine_failure(engine: str, query: str, detail: str) -> dict[str, Any]:
    return {
        "query": query,
        "candidate_urls": [],
        "summary": None,
        "proposals": [],
        "errors": [
            ScanSourceError(
                source_id=f"discover-{engine}",
                source_name=engine,
                source_url="about:blank",
                detail=detail,
            )
        ],
        "llm_used": False,
    }


async def discover_with_perplexity(query: str | None = None) -> dict[str, Any]:
    """Raw Perplexity Search API results. Same proposal shape as OpenAI search."""
    q = (query or "").strip() or DEFAULT_DISCOVER_QUERY
    if not settings.perplexity_api_key:
        return _engine_failure(
            "perplexity", q, "PERPLEXITY_API_KEY is not configured"
        )

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                "https://api.perplexity.ai/search",
                headers={
                    "Authorization": f"Bearer {settings.perplexity_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "query": perplexity_query(q),
                    "max_results": _MAX_URLS,
                    "country": "US",
                    "search_domain_filter": [
                        f"-{host}" for host in _PERPLEXITY_DENY_HOSTS
                    ],
                },
            )
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        logger.exception("Discover POC Perplexity search failed")
        detail = "Perplexity search failed"
        if "timeout" in str(exc).lower():
            detail = "Perplexity search timed out — try again"
        return _engine_failure("perplexity", q, detail)

    proposals: list[ScanProposal] = []
    candidate_urls: list[str] = []
    for index, item in enumerate(payload.get("results") or []):
        if not isinstance(item, dict):
            continue
        url = _normalize_url(item.get("url") if isinstance(item.get("url"), str) else None)
        if not url or _score_url(url) <= -50:
            continue
        title = str(item.get("title") or "").strip() or _host(url) or "page"
        snippet = str(item.get("snippet") or "").strip() or None
        if snippet and len(snippet) > 280:
            snippet = snippet[:277] + "…"
        host = _host(url) or "page"
        candidate_urls.append(url)
        proposals.append(
            ScanProposal(
                key=f"perplexity:{index}:{url[:80]}",
                source_id=f"perplexity-{index}",
                source_name=host,
                source_url=url,
                title=title,
                description=snippet,
                location="Chicago, IL",
                item_url=url,
                warnings=["POC Perplexity search hit — not page-extracted"],
            )
        )

    errors: list[ScanSourceError] = []
    if not proposals:
        errors.append(
            ScanSourceError(
                source_id="discover-perplexity",
                source_name="Perplexity",
                source_url="about:blank",
                detail="Search returned no usable URLs",
            )
        )
    return {
        "query": q,
        "candidate_urls": candidate_urls,
        "summary": None,
        "proposals": proposals,
        "errors": errors,
        "llm_used": False,
    }


async def discover_opportunities_poc_response(
    query: str | None = None,
    engine: str = "both",
) -> tuple[str, list[DiscoverEngineResult]]:
    q = (query or "").strip() or DEFAULT_DISCOVER_QUERY
    wanted = ["openai", "perplexity"] if engine == "both" else [engine]

    async def _one(name: str) -> DiscoverEngineResult:
        if name == "perplexity":
            raw = await discover_with_perplexity(q)
        else:
            raw = await discover_opportunities_poc(q)
        return _engine_result(name, raw)

    engines = list(await asyncio.gather(*[_one(name) for name in wanted]))
    return q, engines
