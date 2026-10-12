from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

TimingKind = Literal["summer", "ongoing", "other"]


class ExtractRequest(BaseModel):
    url: HttpUrl


class ExtractCandidate(BaseModel):
    title: str
    description: str | None = None
    opens_date: str | None = Field(
        default=None,
        description="YYYY-MM-DD when applications open, if known",
    )
    deadline_date: str | None = None
    application_timing: str | None = Field(
        default=None,
        description="Soft timing narrative (windows, announcements)",
    )
    timing_kind: TimingKind | None = Field(
        default=None,
        description="summer | ongoing | other",
    )
    eligibility: str | None = None
    location: str | None = None
    source_url: str | None = Field(
        default=None,
        description="Per-item URL when events/programs link elsewhere",
    )


class ExtractResponse(BaseModel):
    source_url: str
    title: str | None = None
    organization: str | None = None
    description: str | None = None
    location: str | None = None
    opens_date: str | None = Field(
        default=None,
        description="YYYY-MM-DD when applications open, if known",
    )
    deadline_date: str | None = Field(
        default=None,
        description="YYYY-MM-DD if a deadline-like date was found",
    )
    application_timing: str | None = Field(
        default=None,
        description="Soft timing narrative (windows, announcements)",
    )
    timing_kind: TimingKind | None = Field(
        default=None,
        description="summer | ongoing | other",
    )
    eligibility: str | None = None
    candidates: list[ExtractCandidate] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
