from fastapi import APIRouter

from app.core.auth import CurrentUser
from app.core.config import settings
from app.data.curated_sources import CURATED_SOURCES
from app.schemas.extract import ExtractRequest, ExtractResponse
from app.schemas.sources import SourceInfo, SourcesResponse, ScanResponse
from app.services.page_extract import extract_from_url
from app.services.source_scan import scan_curated_sources

router = APIRouter(prefix="/intake", tags=["intake"])


@router.get("/sources", response_model=SourcesResponse)
async def list_curated_sources(_user: CurrentUser) -> SourcesResponse:
    return SourcesResponse(
        sources=[
            SourceInfo(id=s.id, name=s.name, url=s.url) for s in CURATED_SOURCES
        ],
        llm_enabled=settings.llm_extract_enabled,
    )


@router.post("/extract", response_model=ExtractResponse)
async def extract_opportunity_page(
    body: ExtractRequest,
    _user: CurrentUser,
) -> ExtractResponse:
    """Fetch a single page URL and pull opportunity-like fields for the form."""
    return await extract_from_url(str(body.url))


@router.post("/scan", response_model=ScanResponse)
async def scan_opportunity_sources(_user: CurrentUser) -> ScanResponse:
    """Fetch curated source pages and propose opportunities to review."""
    return await scan_curated_sources()
