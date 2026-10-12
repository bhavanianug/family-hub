from app.schemas.extract import ExtractCandidate, ExtractResponse
from app.services.llm_extract import parse_llm_payload, scrub_extract_response


def test_parse_llm_payload_maps_candidates() -> None:
    data = {
        "source_url": "https://example.org/programs",
        "title": "Teen Programs",
        "organization": "Example Org",
        "description": "Hub page",
        "location": "Chicago, IL",
        "deadline_date": None,
        "application_timing": "Opens early 2027",
        "eligibility": None,
        "candidates": [
            {
                "title": "Summer Research",
                "description": "Lab experience",
                "deadline_date": "2027-03-15",
                "application_timing": None,
                "timing_kind": "summer",
                "eligibility": "Grades 10-12",
                "location": "Evanston, IL",
                "source_url": "https://example.org/summer",
            }
        ],
        "warnings": [],
    }
    result = parse_llm_payload(data, "https://fallback.example")
    assert result.title == "Teen Programs"
    assert result.organization == "Example Org"
    assert len(result.candidates) == 1
    assert result.candidates[0].title == "Summer Research"
    assert result.candidates[0].deadline_date == "2027-03-15"
    assert result.candidates[0].timing_kind == "summer"
    assert result.warnings[0].startswith("Extracted with AI")


def test_parse_llm_payload_skips_empty_candidate_titles() -> None:
    data = {
        "candidates": [{"title": ""}, {"title": "  "}, {"title": "Real Program"}],
        "warnings": [],
    }
    result = parse_llm_payload(data, "https://example.org")
    assert [c.title for c in result.candidates] == ["Real Program"]


def test_scrub_drops_related_news_and_past_deadlines() -> None:
    result = scrub_extract_response(
        ExtractResponse(
            source_url="https://example.org",
            title="REACH",
            deadline_date="2025-07-29",
            application_timing="Applications for 2027 open in January 2027.",
            candidates=[
                ExtractCandidate(
                    title="Related News",
                    description=(
                        "REACH 2025 Wraps Another Stellar Summer at CIERA August 15, 2025 "
                        "REACH and RET 2024 foster cross-generational community October 11, 2024"
                    ),
                    deadline_date="2024-10-11",
                ),
                ExtractCandidate(
                    title="REACH",
                    deadline_date="2025-07-29",
                    application_timing="Opens January 2027",
                ),
            ],
            warnings=[],
        )
    )
    assert result.deadline_date is None
    assert result.application_timing is not None
    assert all(c.title != "Related News" for c in result.candidates)
    assert result.candidates[0].title == "REACH"
    assert result.candidates[0].deadline_date is None
