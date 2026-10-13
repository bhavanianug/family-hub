from app.services.college_web_search import parse_resolve_payload, _pick_best_url


def test_pick_best_url_prefers_edu_admissions() -> None:
    best = _pick_best_url(
        [
            "https://en.wikipedia.org/wiki/Northwestern_University",
            "https://www.northwestern.edu/admissions/apply/deadlines.html",
            "https://www.niche.com/colleges/northwestern-university/",
        ]
    )
    assert best is not None
    assert "northwestern.edu" in best
    assert "admission" in best or "deadline" in best


def test_parse_resolve_payload_uses_json_url() -> None:
    result = parse_resolve_payload(
        college_name="UIUC",
        output_text='{"url":"https://www.admissions.illinois.edu/apply/freshman","page_title":"Freshman","reason":"Official"}',
        citations=[],
    )
    assert result.url == "https://www.admissions.illinois.edu/apply/freshman"
    assert result.page_title == "Freshman"
    assert result.searched is True


def test_parse_resolve_payload_falls_back_to_citation() -> None:
    result = parse_resolve_payload(
        college_name="UChicago",
        output_text='{"url":null,"page_title":null,"reason":"unclear"}',
        citations=[
            "https://collegeadmissions.uchicago.edu/apply",
            "https://www.niche.com/colleges/university-of-chicago/",
        ],
    )
    assert result.url == "https://collegeadmissions.uchicago.edu/apply"


def test_parse_resolve_payload_rejects_aggregators_only() -> None:
    result = parse_resolve_payload(
        college_name="Somewhere",
        output_text='{"url":"https://en.wikipedia.org/wiki/Somewhere","page_title":"Wiki","reason":"only wiki"}',
        citations=["https://www.niche.com/colleges/somewhere/"],
    )
    assert result.url is None
