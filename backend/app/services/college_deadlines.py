from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timezone
from typing import Any

from openai import AsyncOpenAI

from app.core.config import settings
from app.schemas.college import CollegeDeadlinesResponse
from app.services.college_web_search import resolve_college_admissions_url
from app.services.page_extract import fetch_cleaned_page

logger = logging.getLogger(__name__)

_MAX_TEXT_CHARS = 16_000
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_SYSTEM = """You extract undergraduate first-year application deadlines from an admissions web page.
Return ONLY valid JSON. Do not invent dates.
- Use null when a plan is not mentioned or only a month/season is given without a day.
- Dates must be YYYY-MM-DD for the upcoming or current admissions cycle when the year is clear.
- early_action = non-binding Early Action deadline.
- early_decision = binding Early Decision (ED / ED I) deadline. Ignore ED II unless early_decision is empty and ED II is the only ED date.
- regular_decision = Regular Decision / Regular Action deadline.
- application_timing = short human summary of windows (include rolling, priority, ED II, transfer notes if present).
- Prefer official calendar dates over marketing copy.
"""

_SCHEMA_HINT = {
    "early_action": "YYYY-MM-DD or null",
    "early_decision": "YYYY-MM-DD or null",
    "regular_decision": "YYYY-MM-DD or null",
    "application_timing": "string or null",
}


def _client() -> AsyncOpenAI | None:
    if not settings.openai_api_key:
        return None
    return AsyncOpenAI(api_key=settings.openai_api_key)


def _parse_iso_date(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()[:10]
    if not _ISO_DATE.match(text):
        return None
    try:
        date.fromisoformat(text)
    except ValueError:
        return None
    return text


def parse_deadlines_payload(
    data: dict[str, Any],
    *,
    college_name: str,
    source_url: str,
) -> CollegeDeadlinesResponse:
    warnings: list[str] = [
        "Deadlines extracted with AI — confirm on the school site before relying on them",
    ]
    raw_warnings = data.get("warnings")
    if isinstance(raw_warnings, list):
        warnings.extend(
            str(w).strip() for w in raw_warnings if str(w).strip()
        )[:8]

    timing = (
        str(data["application_timing"]).strip()[:500]
        if data.get("application_timing")
        else None
    )

    return CollegeDeadlinesResponse(
        college_name=college_name,
        source_url=source_url,
        deadline_early_action=_parse_iso_date(data.get("early_action")),
        deadline_early_decision=_parse_iso_date(data.get("early_decision")),
        deadline_regular=_parse_iso_date(data.get("regular_decision")),
        application_timing=timing,
        deadlines_updated_at=datetime.now(timezone.utc).isoformat(),
        warnings=warnings,
        searched=False,
    )


async def extract_deadlines_from_url(
    *,
    college_name: str,
    url: str,
) -> CollegeDeadlinesResponse:
    client = _client()
    final_url, _soup, page_text, fetch_warnings = await fetch_cleaned_page(url)

    if client is None:
        return CollegeDeadlinesResponse(
            college_name=college_name,
            source_url=final_url,
            warnings=[*fetch_warnings, "OPENAI_API_KEY is not configured"],
            searched=False,
        )

    text = page_text[:_MAX_TEXT_CHARS]
    user_prompt = (
        f"College: {college_name}\n"
        f"Source URL: {final_url}\n\n"
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
            raise ValueError("LLM returned non-object JSON")
    except Exception:
        logger.exception("College deadline extract failed for %s", final_url)
        return CollegeDeadlinesResponse(
            college_name=college_name,
            source_url=final_url,
            warnings=[*fetch_warnings, "Could not extract deadlines from this page"],
            searched=False,
        )

    result = parse_deadlines_payload(
        data, college_name=college_name, source_url=final_url
    )
    if fetch_warnings:
        result.warnings = [*fetch_warnings, *result.warnings]
    if not any(
        [
            result.deadline_early_action,
            result.deadline_early_decision,
            result.deadline_regular,
            result.application_timing,
        ]
    ):
        result.warnings.append("No application deadlines found on this page")
    return result


async def pull_college_deadlines(
    *,
    college_name: str,
    url: str | None = None,
) -> CollegeDeadlinesResponse:
    name = college_name.strip()
    source = (url or "").strip() or None
    searched = False

    if not source:
        resolved = await resolve_college_admissions_url(name)
        searched = resolved.searched
        if not resolved.url:
            return CollegeDeadlinesResponse(
                college_name=name,
                source_url=None,
                warnings=resolved.warnings
                or ["Could not find an admissions URL — paste one and try again"],
                searched=searched,
            )
        source = resolved.url

    result = await extract_deadlines_from_url(college_name=name, url=source)
    result.searched = searched
    return result
