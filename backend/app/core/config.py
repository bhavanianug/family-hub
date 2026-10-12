from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Family Hub API"
    environment: str = "development"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        """Accept JSON arrays or comma-separated origins from env."""
        if isinstance(value, str):
            text = value.strip()
            if not text:
                return []
            if text.startswith("["):
                return value
            return [part.strip() for part in text.split(",") if part.strip()]
        return value
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
