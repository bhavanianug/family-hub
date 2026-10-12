from __future__ import annotations

import asyncio
import logging

from fastapi import HTTPException

from app.core.config import settings
from app.data.curated_sources import CURATED_SOURCES, CuratedSource
from app.schemas.extract import ExtractResponse
from app.schemas.sources import ScanProposal, ScanResponse, ScanSourceError
from app.services.page_extract import extract_from_url

logger = logging.getLogger(__name__)

_SCAN_CONCURRENCY = 3


def _proposals_from_extract(
    source: CuratedSource,
    extracted: ExtractResponse,
) -> list[ScanProposal]:
    proposals: list[ScanProposal] = []
    page_url = extracted.source_url or source.url

    if extracted.candidates:
        for index, candidate in enumerate(extracted.candidates):
            proposals.append(
                ScanProposal(
                    key=f"{source.id}:{index}:{candidate.title[:40]}",
                    source_id=source.id,
                    source_name=source.name,
                    source_url=page_url,
                    title=candidate.title,
                    organization=extracted.organization,
                    description=candidate.description or extracted.description,
                    location=candidate.location or extracted.location,
                    opens_date=candidate.opens_date or extracted.opens_date,
                    deadline_date=candidate.deadline_date or extracted.deadline_date,
                    application_timing=(
                        candidate.application_timing or extracted.application_timing
                    ),
                    timing_kind=candidate.timing_kind or extracted.timing_kind,
                    eligibility=candidate.eligibility or extracted.eligibility,
                    item_url=candidate.source_url or page_url,
                    warnings=list(extracted.warnings),
                )
            )
        return proposals

    title = extracted.title or source.name
    proposals.append(
        ScanProposal(
            key=f"{source.id}:page",
            source_id=source.id,
            source_name=source.name,
            source_url=page_url,
            title=title,
            organization=extracted.organization,
            description=extracted.description,
            location=extracted.location,
            opens_date=extracted.opens_date,
            deadline_date=extracted.deadline_date,
            application_timing=extracted.application_timing,
            timing_kind=extracted.timing_kind,
            eligibility=extracted.eligibility,
            item_url=page_url,
            warnings=list(extracted.warnings),
        )
    )
    return proposals


async def _scan_one(source: CuratedSource) -> tuple[list[ScanProposal], ScanSourceError | None]:
    try:
        extracted = await extract_from_url(source.url)
        return _proposals_from_extract(source, extracted), None
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return [], ScanSourceError(
            source_id=source.id,
            source_name=source.name,
            source_url=source.url,
            detail=detail,
        )
    except Exception as exc:
        logger.exception("Scan failed for %s", source.url)
        return [], ScanSourceError(
            source_id=source.id,
            source_name=source.name,
            source_url=source.url,
            detail=str(exc) or "Scan failed",
        )


async def scan_curated_sources() -> ScanResponse:
    semaphore = asyncio.Semaphore(_SCAN_CONCURRENCY)
    proposals: list[ScanProposal] = []
    errors: list[ScanSourceError] = []
    llm_used = False

    async def run(source: CuratedSource) -> None:
        nonlocal llm_used
        async with semaphore:
            items, error = await _scan_one(source)
            if error:
                errors.append(error)
            else:
                proposals.extend(items)
                if any(
                    "Extracted with AI" in w
                    for item in items
                    for w in item.warnings
                ):
                    llm_used = True

    await asyncio.gather(*(run(source) for source in CURATED_SOURCES))

    # Stable order: by source order, then title
    source_order = {s.id: i for i, s in enumerate(CURATED_SOURCES)}
    proposals.sort(key=lambda p: (source_order.get(p.source_id, 99), p.title.casefold()))

    if not settings.llm_extract_enabled:
        for proposal in proposals:
            if not any("AI" in w for w in proposal.warnings):
                proposal.warnings.append(
                    "Scanned with rules only — set OPENAI_API_KEY for smarter extract"
                )

    return ScanResponse(
        proposals=proposals,
        errors=errors,
        llm_used=llm_used or settings.llm_extract_enabled,
    )
