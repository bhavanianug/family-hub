from app.core.config import _parse_cors_origins


def test_parse_cors_origins_formats() -> None:
    assert _parse_cors_origins("https://app.vercel.app") == ["https://app.vercel.app"]
    assert _parse_cors_origins("https://a.com, https://b.com") == [
        "https://a.com",
        "https://b.com",
    ]
    assert _parse_cors_origins('["https://app.vercel.app"]') == ["https://app.vercel.app"]
    assert _parse_cors_origins("['https://app.vercel.app']") == ["https://app.vercel.app"]
