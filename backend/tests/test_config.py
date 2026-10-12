from app.core.config import Settings, _parse_cors_origins


def test_parse_cors_origins_formats() -> None:
    assert _parse_cors_origins("https://app.vercel.app") == ["https://app.vercel.app"]
    assert _parse_cors_origins("https://a.com, https://b.com") == [
        "https://a.com",
        "https://b.com",
    ]
    assert _parse_cors_origins('["https://app.vercel.app"]') == ["https://app.vercel.app"]
    assert _parse_cors_origins("['https://app.vercel.app']") == ["https://app.vercel.app"]


def test_settings_accepts_plain_cors_url(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://family-hub-mu-nine.vercel.app")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["https://family-hub-mu-nine.vercel.app"]


def test_settings_accepts_comma_cors_urls(monkeypatch) -> None:
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "https://family-hub-mu-nine.vercel.app,http://localhost:5173",
    )
    settings = Settings(_env_file=None)
    assert settings.cors_origins == [
        "https://family-hub-mu-nine.vercel.app",
        "http://localhost:5173",
    ]
