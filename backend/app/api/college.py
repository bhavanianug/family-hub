from fastapi import APIRouter, HTTPException, status

from app.core.auth import CurrentUser
from app.core.config import settings
from app.schemas.college import (
    CollegeDeadlinesRequest,
    CollegeDeadlinesResponse,
    CollegeResolveRequest,
    CollegeResolveResponse,
)
from app.services.college_deadlines import pull_college_deadlines
from app.services.college_web_search import resolve_college_admissions_url

router = APIRouter(prefix="/college", tags=["college"])


@router.post("/resolve-url", response_model=CollegeResolveResponse)
async def resolve_college_url(
    body: CollegeResolveRequest,
    _user: CurrentUser,
) -> CollegeResolveResponse:
    """Use OpenAI web search to find an official admissions URL from a college name."""
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI is not configured (set OPENAI_API_KEY)",
        )
    return await resolve_college_admissions_url(body.name)


@router.post("/pull-deadlines", response_model=CollegeDeadlinesResponse)
async def pull_deadlines(
    body: CollegeDeadlinesRequest,
    _user: CurrentUser,
) -> CollegeDeadlinesResponse:
    """Find (if needed) an admissions URL and extract EA/ED/RD deadlines."""
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI is not configured (set OPENAI_API_KEY)",
        )
    return await pull_college_deadlines(
        college_name=body.name,
        url=str(body.url) if body.url else None,
    )
