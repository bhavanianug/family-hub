from __future__ import annotations

import ipaddress
import re
import socket
from datetime import datetime
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup, Tag
from fastapi import HTTPException, status

from app.schemas.extract import ExtractCandidate, ExtractResponse, TimingKind
from app.services.llm_extract import extract_with_llm, scrub_extract_response

_MAX_BYTES = 1_500_000
_TIMEOUT = httpx.Timeout(12.0, connect=5.0)
_MAX_CANDIDATES = 24
_MONTH = (
    r"january|february|march|april|may|june|july|august|september|"
    r"october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec"
)

_SKIP_TITLES = re.compile(
    r"^(menu|navigation|footer|search|cost|apply|application|related news|"
    r"news|faq|faqs|contact|about|credits?|poster)$",
    re.I,
)
_GENERIC_TITLES = re.compile(r"^(apply|application|applications|home|welcome)$", re.I)


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


_SUMMER_HINT = re.compile(
    r"\b(summer|summers|june.?august|july.?august|summer\s+(program|internship|research|camp|institute))\b",
    re.I,
)
_ONGOING_HINT = re.compile(
    r"\b(year[- ]?round|rolling\s+(basis|admission|applications?)|ongoing|"
    r"drop[- ]?in|weekly|every\s+week|continuous|open\s+enrollment)\b",
    re.I,
)


def _infer_timing_kind(*parts: str | None) -> TimingKind:
    text = " ".join(p for p in parts if p)
    if not text:
        return "ongoing"
    if _SUMMER_HINT.search(text):
        return "summer"
    return "ongoing"


def _assert_public_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid URL")
    host = parsed.hostname.lower()
    if host in {"localhost", "metadata.google.internal"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That host is not allowed")

    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not resolve hostname",
        ) from exc

    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That host is not allowed",
            )


def _meta(soup: BeautifulSoup, *keys: str) -> str | None:
    for key in keys:
        tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
        if tag and tag.get("content"):
            value = str(tag["content"]).strip()
            if value:
                return value
    return None


def _parse_deadline(raw: str, default_year: int | None = None) -> str | None:
    cleaned = _clean(raw)
    cleaned = re.sub(r"(\d{1,2})(?:st|nd|rd|th)\b", r"\1", cleaned, flags=re.I)
    cleaned = cleaned.replace(",", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    for fmt in ("%B %d %Y", "%b %d %Y", "%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(cleaned, fmt).date().isoformat()
        except ValueError:
            continue
    if default_year is not None:
        with_year = f"{cleaned} {default_year}"
        for fmt in ("%B %d %Y", "%b %d %Y"):
            try:
                return datetime.strptime(with_year, fmt).date().isoformat()
            except ValueError:
                continue
    return None


def _find_standalone_date(text: str) -> str | None:
    match = re.search(
        rf"\b((?:{_MONTH})\.?\s+\d{{1,2}}\s*,?\s*\d{{4}})\b",
        text,
        re.I,
    )
    if match:
        return _parse_deadline(match.group(1))
    match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", text)
    return _parse_deadline(match.group(1)) if match else None


def _find_deadline(text: str) -> str | None:
    year_match = re.search(r"\b(20\d{2})\s+program\b", text, re.I)
    year = int(year_match.group(1)) if year_match else None
    # "Application Dates: January 12, 2027 – March 1, 2027" → close date
    window = re.search(
        rf"(?:application\s+dates?|applications?\s+open)\s*[:\-]?\s*"
        rf"(?:{_MONTH})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?(?:\s*,?\s*\d{{4}})?\s*"
        rf"[-–—to]+\s*"
        rf"((?:{_MONTH})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?(?:\s*,?\s*\d{{4}})?)",
        text,
        re.I,
    )
    if window:
        end = window.group(1)
        # If end lacks year, borrow from start of window or nearby year
        if not re.search(r"20\d{2}", end):
            start_year = re.search(r"20\d{2}", window.group(0))
            if start_year:
                end = f"{end} {start_year.group(0)}"
        parsed = _parse_deadline(end, default_year=year)
        if parsed:
            return parsed
    match = re.search(
        rf"(?:application\s+)?deadline(?:\s+date)?\s*[:\-]?\s*"
        rf"((?:{_MONTH})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?(?:\s*,?\s*\d{{4}})?|"
        rf"\d{{1,2}}/\d{{1,2}}/\d{{2,4}}|\d{{4}}-\d{{2}}-\d{{2}})",
        text,
        re.I,
    )
    if not match:
        return None
    return _parse_deadline(match.group(1), default_year=year)


def _find_opens_date(text: str) -> str | None:
    """Start of an application window when a calendar day is stated."""
    year_match = re.search(r"\b(20\d{2})\b", text)
    year = int(year_match.group(1)) if year_match else None
    window = re.search(
        rf"(?:application\s+dates?|applications?\s+open(?:\s+on)?)\s*[:\-]?\s*"
        rf"((?:{_MONTH})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?(?:\s*,?\s*\d{{4}})?)",
        text,
        re.I,
    )
    if window:
        return _parse_deadline(window.group(1), default_year=year)
    return None


def _find_eligibility(text: str) -> str | None:
    match = re.search(
        r"((?:Be a current high school|Open to high school|grades?\s+\d{1,2}"
        r"\s*[-–]\s*\d{1,2})[^.]{0,100}\.)",
        text,
        re.I,
    )
    if not match:
        return None
    value = _clean(match.group(1))[:160]
    if re.search(r"\b(menu|faqs?|newsletter)\b", value, re.I):
        return None
    return value


def _find_application_timing(text: str) -> str | None:
    """Keep sentences about apply windows / session status / announcement cadence."""
    kept: list[str] = []
    seen: set[str] = set()
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        s = _clean(sentence)
        if len(s) < 24 or len(s) > 280:
            continue
        lower = s.lower()
        if not any(k in lower for k in ("application", "apply", "announcement", "session")):
            continue
        if not any(
            k in lower
            for k in (
                "closed",
                "full",
                "open",
                "announc",
                "spring",
                "fall",
                "january",
                "november",
                "may for",
                "expected",
            )
        ):
            continue
        if re.search(r"\b(begins? on saturday|through saturday|schedule)\b", lower):
            continue
        key = lower
        if key in seen:
            continue
        seen.add(key)
        kept.append(s)
        if len(kept) >= 3:
            break
    return " ".join(kept)[:500] if kept else None


def _guess_location(text: str) -> str | None:
    if re.search(r"\bFermilab\b", text, re.I):
        return "Batavia, IL"
    if re.search(r"\b(Dearborn Observatory|Evanston|Northwestern)\b", text, re.I):
        return "Evanston, IL"
    if re.search(r"\bChicago\b", text, re.I):
        return "Chicago, IL"
    if re.search(r"\bremote\b", text, re.I):
        return "Remote"
    return None


def _guess_organization(soup: BeautifulSoup, text: str, host: str) -> str | None:
    site = _meta(soup, "og:site_name")
    if site:
        return site
    if re.search(r"\bCIERA\b", text):
        return "CIERA (Northwestern)"
    if "fnal.gov" in host or re.search(r"\bFermilab\b", text, re.I):
        return "Fermilab"
    if "northwestern.edu" in host:
        return "Northwestern University"
    if "chipublib.org" in host:
        return "Chicago Public Library"
    if "uic.edu" in host:
        return "University of Illinois Chicago"
    if host:
        return host.removeprefix("www.").split(".")[0].replace("-", " ").title()
    return None


def _usable_title(title: str) -> bool:
    title = _clean(title)
    return 3 <= len(title) <= 140 and not _SKIP_TITLES.match(title)


def _page_title(soup: BeautifulSoup) -> str | None:
    raw = _meta(soup, "og:title", "twitter:title")
    if not raw and soup.title and soup.title.string:
        raw = soup.title.string.strip()
    if not raw:
        return None
    parts = re.split(r"\s+[|\-–]\s+", _clean(raw))
    if len(parts) >= 2 and _GENERIC_TITLES.match(parts[0]):
        raw = parts[-1]
    else:
        raw = re.sub(r"\s+[|\-–].*$", "", raw).strip() or raw
    if _GENERIC_TITLES.match(raw):
        brand = soup.select_one(".site-title, header .site-title a")
        if brand:
            raw = _clean(brand.get_text(" ", strip=True))
    return raw if _usable_title(raw) else None


def _format_display_date(iso_date: str) -> str:
    try:
        return datetime.strptime(iso_date, "%Y-%m-%d").strftime("%b %d, %Y")
    except ValueError:
        return iso_date


def _extract_from_event_cards(soup: BeautifulSoup) -> list[ExtractCandidate]:
    found: list[ExtractCandidate] = []
    seen: set[str] = set()
    for event in soup.select("div.event"):
        title_tag = event.select_one(".event-description h4 a, .event-description h4, h4 a, h4")
        if not title_tag:
            continue
        base = _clean(title_tag.get_text(" ", strip=True))
        if not _usable_title(base):
            continue
        link = None
        if title_tag.name == "a" and title_tag.get("href"):
            link = str(title_tag["href"]).strip()
        else:
            anchor = event.find("a", href=True)
            if anchor:
                link = str(anchor["href"]).strip()
        date_tag = event.select_one(".event-date-inline, time")
        date_text = date_tag.get_text(" ", strip=True) if date_tag else ""
        event_date = _find_standalone_date(date_text) or _find_standalone_date(
            event.get_text(" ", strip=True)
        )
        time_tag = event.select_one(".event-time")
        time_text = _clean(time_tag.get_text(" ", strip=True)) if time_tag else ""
        loc = _guess_location(event.get_text(" ", strip=True))
        title = f"{base} — {_format_display_date(event_date)}" if event_date else base
        if title.casefold() in seen:
            continue
        seen.add(title.casefold())
        found.append(
            ExtractCandidate(
                title=title,
                description=", ".join(p for p in (time_text, loc) if p) or None,
                deadline_date=event_date,
                location=loc,
                source_url=link,
            )
        )
        if len(found) >= _MAX_CANDIDATES:
            break
    return found


def _extract_from_details(soup: BeautifulSoup) -> list[ExtractCandidate]:
    found: list[ExtractCandidate] = []
    seen: set[str] = set()
    for details in soup.find_all("details"):
        if not isinstance(details, Tag):
            continue
        summary = details.find("summary")
        if not isinstance(summary, Tag):
            continue
        title = _clean(summary.get_text(" ", strip=True))
        if not _usable_title(title) or title.casefold() in seen:
            continue
        parts: list[str] = []
        for child in details.children:
            if isinstance(child, Tag) and child.name == "summary":
                continue
            if isinstance(child, Tag):
                parts.append(child.get_text(" ", strip=True))
            elif isinstance(child, str) and child.strip():
                parts.append(child.strip())
        body = _clean(" ".join(parts))
        if len(body) < 8:
            continue
        seen.add(title.casefold())
        found.append(
            ExtractCandidate(
                title=title,
                description=body[:480] or None,
                deadline_date=_find_deadline(f"{title}. {body}"),
                application_timing=_find_application_timing(body),
                timing_kind=_infer_timing_kind(title, body),
                eligibility=_find_eligibility(body),
                location=_guess_location(body),
            )
        )
        if len(found) >= _MAX_CANDIDATES:
            break
    return found


def extract_candidates(
    soup: BeautifulSoup,
    page_application_timing: str | None = None,
) -> list[ExtractCandidate]:
    candidates = _extract_from_event_cards(soup) or _extract_from_details(soup)
    enriched: list[ExtractCandidate] = []
    for candidate in candidates:
        updates: dict[str, object] = {}
        if page_application_timing and not (
            candidate.deadline_date or candidate.application_timing
        ):
            updates["application_timing"] = page_application_timing
        if not candidate.timing_kind:
            updates["timing_kind"] = _infer_timing_kind(
                candidate.title,
                candidate.description,
                candidate.application_timing or page_application_timing,
            )
        enriched.append(candidate.model_copy(update=updates) if updates else candidate)
    return enriched


async def fetch_cleaned_page(url: str) -> tuple[str, BeautifulSoup, str, list[str]]:
    _assert_public_url(url)
    warnings: list[str] = []
    headers = {
        "User-Agent": "FamilyHubBot/0.1 (+local opportunity intake)",
        "Accept": "text/html,application/xhtml+xml",
    }
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            follow_redirects=True,
            headers=headers,
            max_redirects=5,
        ) as client:
            response = await client.get(url)
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Timed out fetching that page",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not fetch that page",
        ) from exc

    final_url = str(response.url)
    _assert_public_url(final_url)
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Page returned HTTP {response.status_code}",
        )
    content_type = response.headers.get("content-type", "")
    if "html" not in content_type.lower() and not response.text.lstrip().startswith("<"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="URL did not return an HTML page",
        )

    html = response.text
    if len(html.encode("utf-8", errors="ignore")) > _MAX_BYTES:
        html = html[:_MAX_BYTES]
        warnings.append("Page was truncated because it was very large")

    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return final_url, soup, _clean(soup.get_text(" ", strip=True)), warnings


def extract_with_rules(
    soup: BeautifulSoup,
    final_url: str,
    warnings: list[str] | None = None,
) -> ExtractResponse:
    warnings = list(warnings or [])
    host = urlparse(final_url).hostname or ""
    text = _clean(soup.get_text(" ", strip=True))
    sample = text[:12000]

    title = _page_title(soup)
    description = _meta(soup, "og:description", "twitter:description", "description")
    organization = _guess_organization(soup, sample, host)
    opens_date = _find_opens_date(sample)
    deadline_date = _find_deadline(sample)
    application_timing = _find_application_timing(sample)
    eligibility = _find_eligibility(sample)
    location = _guess_location(sample) or "Chicago, IL"
    candidates = extract_candidates(soup, page_application_timing=application_timing)
    timing_kind = _infer_timing_kind(title, description, application_timing, sample[:2000])

    if candidates:
        warnings.append(
            f"Found {len(candidates)} item"
            f"{'s' if len(candidates) != 1 else ''} on this page — select which to add"
        )
        if len(candidates) == 1:
            only = candidates[0]
            if not title or _GENERIC_TITLES.match(title):
                title = only.title
            if only.description:
                description = only.description
            if only.opens_date:
                opens_date = only.opens_date
            if only.deadline_date:
                deadline_date = only.deadline_date
            if only.application_timing:
                application_timing = only.application_timing
            if only.timing_kind:
                timing_kind = only.timing_kind
            if only.eligibility:
                eligibility = only.eligibility
            if only.location:
                location = only.location
    else:
        if application_timing:
            warnings.append(f"Next cycle: {application_timing}")
        elif not deadline_date and not opens_date:
            warnings.append("No clear open/deadline dates found — add manually if you know them")
        if not title:
            warnings.append("Could not find a title — enter one manually")

    return scrub_extract_response(
        ExtractResponse(
            source_url=final_url,
            title=title,
            organization=organization,
            description=description,
            location=location,
            opens_date=opens_date,
            deadline_date=deadline_date,
            application_timing=application_timing,
            timing_kind=timing_kind,
            eligibility=eligibility,
            candidates=candidates,
            warnings=warnings,
        )
    )


async def extract_from_url(url: str) -> ExtractResponse:
    final_url, soup, page_text, warnings = await fetch_cleaned_page(url)
    llm_result = await extract_with_llm(final_url, page_text)
    if llm_result is not None:
        if warnings:
            llm_result.warnings = [*warnings, *llm_result.warnings]
        return llm_result
    return extract_with_rules(soup, final_url, warnings)
