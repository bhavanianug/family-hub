from app.services.college_deadlines import parse_deadlines_payload


def test_parse_deadlines_payload_maps_dates() -> None:
    result = parse_deadlines_payload(
        {
            "early_action": "2026-11-01",
            "early_decision": "2026-11-01",
            "regular_decision": "2027-01-05",
            "application_timing": "EA/ED Nov 1; RD Jan 5",
        },
        college_name="Northwestern",
        source_url="https://admissions.northwestern.edu/",
    )
    assert result.deadline_early_action == "2026-11-01"
    assert result.deadline_early_decision == "2026-11-01"
    assert result.deadline_regular == "2027-01-05"
    assert result.application_timing is not None
    assert result.source_url.endswith("northwestern.edu/")


def test_parse_deadlines_payload_rejects_bad_dates() -> None:
    result = parse_deadlines_payload(
        {
            "early_action": "November 1",
            "early_decision": None,
            "regular_decision": "not-a-date",
            "application_timing": "Rolling",
        },
        college_name="Test U",
        source_url="https://example.edu/apply",
    )
    assert result.deadline_early_action is None
    assert result.deadline_regular is None
    assert result.application_timing == "Rolling"
