from bs4 import BeautifulSoup

from app.services.page_extract import (
    _find_application_timing,
    _find_deadline,
    _find_eligibility,
    _find_opens_date,
    _infer_timing_kind,
    _parse_deadline,
    extract_candidates,
)


def test_parse_deadline_formats() -> None:
    assert _parse_deadline("March 15, 2026") == "2026-03-15"
    assert _parse_deadline("2026-04-01") == "2026-04-01"
    assert _parse_deadline("04/01/2026") == "2026-04-01"


def test_find_deadline_in_copy() -> None:
    text = "Applications welcome. Application deadline: June 1, 2027 for high school students."
    assert _find_deadline(text) == "2027-06-01"


def test_find_deadline_ordinal_with_program_year() -> None:
    text = "Applications for the 2027 program have now closed. Deadline: March 9th."
    assert _find_deadline(text) == "2027-03-09"


def test_find_opens_and_deadline_from_application_window() -> None:
    text = (
        "Program Dates: July 12, 2027 – August 6, 2027 "
        "Application Dates: January 12, 2027 – March 1, 2027 "
        "Offer Date: April 12, 2027"
    )
    assert _find_opens_date(text) == "2027-01-12"
    assert _find_deadline(text) == "2027-03-01"


def test_find_eligibility_high_school_grades() -> None:
    text = (
        "Eligibility To be eligible for the program, students must: "
        "Be a current high school sophomore, junior, or senior (grades 10-12) "
        "at time of application. Be able to arrange their own transportation."
    )
    elig = _find_eligibility(text)
    assert elig is not None
    assert "high school" in elig.lower()


def test_extract_candidates_from_details_accordion() -> None:
    html = """
    <html><body>
      <h1>Teen Programs</h1>
      <details>
        <summary>Astro Ambassadors</summary>
        <p>High school students explore astronomy. Open to grades 9-12.
        Application deadline: March 15, 2027.</p>
      </details>
      <details>
        <summary>Youth Volunteers</summary>
        <p>Volunteer program for teens. Eligibility: ages 14-18.</p>
      </details>
    </body></html>
    """
    soup = BeautifulSoup(html, "lxml")
    candidates = extract_candidates(soup)
    titles = [c.title for c in candidates]
    assert "Astro Ambassadors" in titles
    assert "Youth Volunteers" in titles
    astro = next(c for c in candidates if c.title == "Astro Ambassadors")
    assert astro.deadline_date == "2027-03-15"


def test_infer_timing_kind_summer_and_ongoing() -> None:
    assert _infer_timing_kind("PRISM Summer Research") == "summer"
    assert _infer_timing_kind("Teen Club", "Year-round drop-in programming") == "ongoing"
    assert _infer_timing_kind("One-day competition") == "ongoing"


def test_find_application_timing_soft_copy() -> None:
    text = (
        "Teen programs at the museum. "
        "Applications for the spring 2027 session will be open in early 2027. "
        "Learn more below."
    )
    timing = _find_application_timing(text)
    assert timing is not None
    assert "spring 2027" in timing.lower()


def test_find_application_timing_smp_style_next_session() -> None:
    text = (
        "Application Fall 2026 session applications are now closed and the session is full. "
        "Interested students should consider applying for the Spring 2027 session "
        "which will be announced in November. "
        "An announcement of the SMP program is made in May for the fall program "
        "and in November for the spring program. "
        "Schedule Fall 2026 session begins on Saturday, September 12th."
    )
    timing = _find_application_timing(text)
    assert timing is not None
    lower = timing.lower()
    assert "closed" in lower or "full" in lower
    assert "spring 2027" in lower
    assert "november" in lower


def test_extract_candidates_from_event_cards() -> None:
    html = """
    <html><body>
      <h3>Upcoming Events</h3>
      <div class="event-list">
        <div class="event">
          <div class="event-description">
            <h4><a href="https://planitpurple.northwestern.edu/event/1">CIERA Astronomer Evenings</a></h4>
            <p class="event-time-location">
              <span class="event-date-inline">Oct 30 , 2026</span>
              <span class="event-time">8:00 PM</span>
              Dearborn Observatory
            </p>
          </div>
        </div>
        <div class="event">
          <div class="event-description">
            <h4><a href="https://planitpurple.northwestern.edu/event/2">CIERA Astronomer Evenings</a></h4>
            <p class="event-time-location">
              <span class="event-date-inline">Dec 04 , 2026</span>
              <span class="event-time">8:00 PM</span>
              Dearborn Observatory
            </p>
          </div>
        </div>
      </div>
    </body></html>
    """
    soup = BeautifulSoup(html, "lxml")
    candidates = extract_candidates(soup)
    assert len(candidates) == 2
    assert candidates[0].deadline_date == "2026-10-30"
    assert candidates[1].deadline_date == "2026-12-04"
    assert candidates[0].source_url and "event/1" in candidates[0].source_url


def test_page_timing_attaches_to_candidates_without_deadline() -> None:
    html = """
    <html><body>
      <p>Applications for the spring 2027 session will be open in early 2027.</p>
      <details>
        <summary>Astro Ambassadors</summary>
        <p>High school students explore astronomy and peer teaching.</p>
      </details>
    </body></html>
    """
    soup = BeautifulSoup(html, "lxml")
    timing = _find_application_timing(soup.get_text(" ", strip=True))
    candidates = extract_candidates(soup, page_application_timing=timing)
    assert len(candidates) == 1
    assert candidates[0].application_timing is not None
    assert "2027" in candidates[0].application_timing
