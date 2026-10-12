"""Starter curated opportunity source pages (Phase 1)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CuratedSource:
    id: str
    name: str
    url: str


CURATED_SOURCES: tuple[CuratedSource, ...] = (
    CuratedSource(
        id="ciera-reach",
        name="CIERA REACH (high school research)",
        url="https://ciera.northwestern.edu/programs/reach/",
    ),
    CuratedSource(
        id="fnal-smp",
        name="Fermilab Saturday Morning Physics",
        url="https://education.fnal.gov/program/saturdaymorningphysics/",
    ),
    CuratedSource(
        id="fnal-prism",
        name="Fermilab PRISM mentorship",
        url=(
            "https://internships.fnal.gov/"
            "fermilab-program-for-research-innovation-and-stem-mentorship-prism/"
        ),
    ),
    CuratedSource(
        id="griffin-rise",
        name="Griffin Museum RISE Teen Program",
        url="https://www.griffinmsi.org/youth-and-families/rise-teen-program#registration",
    ),
    CuratedSource(
        id="uic-impact",
        name="UIC IMPACT summer engineering",
        url=(
            "https://engineering.uic.edu/about/summer-special-programs/"
            "impact-summer-engineering-experience/"
        ),
    ),
    CuratedSource(
        id="cpl-assistantship",
        name="Chicago Public Library school-year assistantship",
        url=(
            "https://www.chipublib.org/news/"
            "chicago-public-library-school-year-assistantship/"
        ),
    ),
)
