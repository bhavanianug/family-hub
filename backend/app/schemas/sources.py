from pydantic import BaseModel, Field

from app.schemas.extract import TimingKind


class SourceInfo(BaseModel):
    id: str
    name: str
    url: str


class SourcesResponse(BaseModel):
    sources: list[SourceInfo]
    llm_enabled: bool = False


class ScanProposal(BaseModel):
    key: str
    source_id: str
    source_name: str
    source_url: str
    title: str
    organization: str | None = None
    description: str | None = None
    location: str | None = None
    opens_date: str | None = None
    deadline_date: str | None = None
    application_timing: str | None = None
    timing_kind: TimingKind | None = None
    eligibility: str | None = None
    item_url: str | None = None
    warnings: list[str] = Field(default_factory=list)


class ScanSourceError(BaseModel):
    source_id: str
    source_name: str
    source_url: str
    detail: str


class ScanResponse(BaseModel):
    proposals: list[ScanProposal]
    errors: list[ScanSourceError] = Field(default_factory=list)
    llm_used: bool = False


class DiscoverPocRequest(BaseModel):
    query: str | None = Field(
        default=None,
        description="Optional search query; uses a Chicago teen STEM default when omitted",
        max_length=400,
    )
    engine: str = Field(
        default="both",
        description="openai, perplexity, or both",
    )


class DiscoverEngineResult(ScanResponse):
    engine: str
    candidate_urls: list[str] = Field(default_factory=list)
    summary: str | None = None


class DiscoverPocResponse(BaseModel):
    query: str
    engines: list[DiscoverEngineResult] = Field(default_factory=list)
