from fastapi import APIRouter

from app.core.auth import CurrentUser
from app.core.config import settings
from app.schemas.me import MeResponse

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeResponse)
async def get_me(user: CurrentUser) -> MeResponse:
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        auth_configured=settings.auth_configured,
    )
