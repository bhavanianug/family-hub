from app.services.discover_poc import (
    DEFAULT_DISCOVER_QUERY,
    _score_url,
    perplexity_query,
    search_prompt,
)


def test_default_query_mentions_chicago_stem() -> None:
    assert "Chicago" in DEFAULT_DISCOVER_QUERY
    assert "STEM" in DEFAULT_DISCOVER_QUERY


def test_score_prefers_edu_program_paths() -> None:
    edu = _score_url("https://ciera.northwestern.edu/programs/reach/")
    wiki = _score_url("https://en.wikipedia.org/wiki/Internship")
    assert edu > 0
    assert wiki < 0
    assert edu > wiki
    assert _score_url("https://www.immerse.education/knowledge-base/jobs") < 0
    assert _score_url("https://mychimyfuture.org/organization-details?id=66") < 0


def test_search_prompt_states_the_ask_and_rejects_mismatches() -> None:
    prompt = search_prompt("Chicago teen architecture summer")
    assert "Chicago teen architecture summer" in prompt
    assert "United States" in prompt
    assert "high school" in prompt
    assert "college" in prompt
    assert "listicles" in prompt


def test_perplexity_query_keeps_user_words() -> None:
    text = perplexity_query("Chicago teen nature volunteer ongoing")
    assert text.startswith("Chicago teen nature volunteer ongoing")
    assert "high school" in text
