from pydantic import BaseModel, Field


class MeResponse(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None
    auth_configured: bool = Field(
        description="Whether the API can verify Supabase JWTs",
    )
