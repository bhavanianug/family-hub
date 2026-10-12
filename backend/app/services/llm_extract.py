from __future__ import annotations

import json
import logging
import re
from datetime import date
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.schemas.extract import ExtractCandidate, ExtractResponse, TimingKind

logger = logging.getLogger(__name__)

_MAX_TEXT_CHARS = 16_000

_JUNK_TITLES = re.compile(
    r"^(related news|news|news & events|gallery|credits?|share|menu|"
    r"overview|about|contact|faq|faqs|click to enlarge.*)$",
    re.I,
)

_SYSTEM = """You extract upcoming teen/high-school STEM opportunities from web page text.
Return ONLY valid JSON matching the schema. Do not invent facts.
- Use null when unknown.
- opens_date = YYYY-MM-DD when applications OPEN (start of the apply window), e.g. "Application Dates: January 12, 2027 – March 1, 2027" → opens_date 2027-01-12.
- deadline_date = YYYY-MM-DD when applications CLOSE (end of window / apply-by date). Same example → deadline_date 2027-03-01.
- Never invent exact days from vague wording. Soft phrases ("opens in January", "announced in November") go in application_timing, and leave opens_date/deadline_date null unless a calendar day is stated.
- Always fill application_timing with a short human summary of the apply window when present (open + close + next cycle notes).
- timing_kind must be one of: "summer", "ongoing".
  - summer = summer program / summer internship / summer research (runs mainly in summer).
  - ongoing = everything else (year-round, school-year, rolling, clubs, one-offs, unclear).
- Prefer upcoming apply windows. Do NOT use past news dates, past session end dates, or article publish dates as opens_date/deadline_date.
- Ignore "Related News", blog posts, press releases, and photo galleries — they are not opportunities.
- If the page lists multiple programs/events to apply for, put each in candidates (each with its own opens_date/deadline_date/timing_kind when known).
- If it is one program page, one candidate (or page-level fields).
- Prefer Chicago / Evanston / Illinois context when location is implied.
- source_url on a candidate only if that item has its own distinct link on the page.
"""

_SCHEMA_HINT = {
    "source_url": "string",
    "title": "string or null",
    "organization": "string or null",
    "description": "string or null",
    "location": "string or null",
    "opens_date": "YYYY-MM-DD or null",
    "deadline_date": "YYYY-MM-DD or null",
    "application_timing": "string or null",
    "timing_kind": "summer | ongoing",
    "eligibility": "string or null",
    "candidates": [
        {
            "title": "string",
            "description": "string or null",
            "opens_date": "YYYY-MM-DD or null",
            "deadline_date": "YYYY-MM-DD or null",
            "application_timing": "string or null",
            "timing_kind": "summer | ongoing",
            "eligibility": "string or null",
            "location": "string or null",
            "source_url": "string or null",
        }
    ],
    "warnings": ["string"],
}


def _parse_timing_kind(value: object) -> TimingKind | None:
    if value is None:
        return None
    kind = str(value).strip().lower()
    if kind == "summer":
        return "summer"
    if kind in ("ongoing", "other", "year-round", "year_round"):
        return "ongoing"
    return None


def _client() -> AsyncOpenAI | None:
    if not settings.llm_extract_enabled:
        return None
    return AsyncOpenAI(api_key=settings.openai_api_key)


def _is_past_iso_date(value: str | None) -> bool:
    if not value:
        return False
    try:
        return date.fromisoformat(value[:10]) < date.today()
    except ValueError:
        return False


def _looks_like_news_blob(text: str | None) -> bool:
    if not text:
        return False
    # Multiple month+year stamps mashed together (related-news scrape)
    hits = re.findall(
        r"\b(?:january|february|march|april|may|june|july|august|september|"
        r"october|november|december)\s+\d{1,2},?\s+20\d{2}\b",
        text,
        re.I,
    )
    return len(hits) >= 2


def _candidate_from_dict(raw: dict[str, Any]) -> ExtractCandidate | None:
    title = str(raw.get("title") or "").strip()
    if not title or _JUNK_TITLES.match(title):
        return None
    description = (
        str(raw["description"]).strip()[:800] if raw.get("description") else None
    )
    if _looks_like_news_blob(description) or _looks_like_news_blob(title):
        return None

    def _date_field(key: str) -> str | None:
        value = raw.get(key)
        if value is None:
            return None
        value = str(value).strip() or None
        if _is_past_iso_date(value):
            return None
        return value

    opens = _date_field("opens_date")
    deadline = _date_field("deadline_date")

    timing = (
        str(raw["application_timing"]).strip()[:300]
        if raw.get("application_timing")
        else None
    )

    return ExtractCandidate(
        title=title[:200],
        description=description,
        opens_date=opens,
        deadline_date=deadline,
        application_timing=timing,
        timing_kind=_parse_timing_kind(raw.get("timing_kind")),
        eligibility=(str(raw["eligibility"]).strip()[:300] if raw.get("eligibility") else None),
        location=(str(raw["location"]).strip()[:120] if raw.get("location") else None),
        source_url=(str(raw["source_url"]).strip() if raw.get("source_url") else None),
    )


def scrub_extract_response(result: ExtractResponse) -> ExtractResponse:
    """Drop news junk and past open/deadline dates from any extract path."""
    warnings = list(result.warnings)
    opens = result.opens_date
    deadline = result.deadline_date
    if _is_past_iso_date(opens):
        warnings.append(f"Ignored past opens date {opens}")
        opens = None
    if _is_past_iso_date(deadline):
        warnings.append(
            f"Ignored past date {deadline} as deadline — use application timing if shown"
        )
        deadline = None

    title = result.title
    if title and _JUNK_TITLES.match(title):
        title = None

    description = result.description
    if _looks_like_news_blob(description):
        description = None

    candidates: list[ExtractCandidate] = []
    for candidate in result.candidates:
        if _JUNK_TITLES.match(candidate.title):
            continue
        if _looks_like_news_blob(candidate.description) or _looks_like_news_blob(
            candidate.title
        ):
            continue
        cand_opens = None if _is_past_iso_date(candidate.opens_date) else candidate.opens_date
        cand_deadline = (
            None if _is_past_iso_date(candidate.deadline_date) else candidate.deadline_date
        )
        candidates.append(
            candidate.model_copy(
                update={"opens_date": cand_opens, "deadline_date": cand_deadline}
            )
        )

    return result.model_copy(
        update={
            "title": title,
            "description": description,
            "opens_date": opens,
            "deadline_date": deadline,
            "candidates": candidates,
            "warnings": warnings,
        }
    )


def parse_llm_payload(data: dict[str, Any], fallback_url: str) -> ExtractResponse:
    candidates_raw = data.get("candidates") or []
    candidates: list[ExtractCandidate] = []
    if isinstance(candidates_raw, list):
        for item in candidates_raw[:24]:
            if isinstance(item, dict):
                cand = _candidate_from_dict(item)
                if cand:
                    candidates.append(cand)

    warnings_raw = data.get("warnings") or []
    warnings: list[str] = []
    if isinstance(warnings_raw, list):
        warnings = [str(w).strip() for w in warnings_raw if str(w).strip()][:12]
    warnings.insert(0, "Extracted with AI — review before saving")

    def _date(key: str) -> str | None:
        value = data.get(key)
        if value is None:
            return None
        return str(value).strip() or None

    result = ExtractResponse(
        source_url=str(data.get("source_url") or fallback_url),
        title=(str(data["title"]).strip()[:200] if data.get("title") else None),
        organization=(
            str(data["organization"]).strip()[:200] if data.get("organization") else None
        ),
        description=(
            str(data["description"]).strip()[:800] if data.get("description") else None
        ),
        location=(str(data["location"]).strip()[:120] if data.get("location") else None),
        opens_date=_date("opens_date"),
        deadline_date=_date("deadline_date"),
        application_timing=(
            str(data["application_timing"]).strip()[:300]
            if data.get("application_timing")
            else None
        ),
        timing_kind=_parse_timing_kind(data.get("timing_kind")),
        eligibility=(
            str(data["eligibility"]).strip()[:300] if data.get("eligibility") else None
        ),
        candidates=candidates,
        warnings=warnings,
    )
    return scrub_extract_response(result)


async def extract_with_llm(source_url: str, page_text: str) -> ExtractResponse | None:
    client = _client()
    if client is None:
        return None

    text = page_text[:_MAX_TEXT_CHARS]
    user_prompt = (
        f"Source URL: {source_url}\n\n"
        f"JSON shape to fill:\n{json.dumps(_SCHEMA_HINT, indent=2)}\n\n"
        f"Page text:\n{text}"
    )

    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = response.choices[0].message.content or ""
        data = json.loads(content)
        if not isinstance(data, dict):
            return None
        return parse_llm_payload(data, source_url)
    except Exception:
        logger.exception("LLM extract failed for %s", source_url)
        return None
