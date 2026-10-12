import json
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _parse_cors_origins(value: object) -> list[str]:
    """Accept a list, JSON array string, or comma-separated origins."""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip().strip('"').strip("'") for item in value if str(item).strip()]
    if not isinstance(value, str):
        return [str(value).strip()] if str(value).strip() else []

    text = value.strip()
    if not text:
        return []

    if text.startswith("["):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [
                    str(item).strip().strip('"').strip("'")
                    for item in parsed
                    if str(item).strip()
                ]
        except json.JSONDecodeError:
            inner = text.strip("[]")
            text = inner

    return [
        part.strip().strip('"').strip("'")
        for part in text.split(",")
        if part.strip().strip('"').strip("'")
    ]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Family Hub API"
    environment: str = "development"
    # NoDecode: pydantic-settings otherwise JSON-parses list fields and
    # rejects plain URLs like https://app.vercel.app before validators run.
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        return _parse_cors_origins(value)
    supabase_url: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None

    openai_api_key: str | None = None
    openai_model: str = "gpt-5-nano"
    extract_use_llm: bool = True

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_jwt_secret)

    @property
    def llm_extract_enabled(self) -> bool:
        return bool(self.extract_use_llm and self.openai_api_key)


settings = Settings()
