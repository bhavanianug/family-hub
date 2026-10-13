from pydantic import BaseModel, Field, HttpUrl


class CollegeResolveRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)


class CollegeResolveResponse(BaseModel):
    college_name: str
    url: str | None = None
    page_title: str | None = None
    citations: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    searched: bool = False


class CollegeDeadlinesRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    url: HttpUrl | None = None


class CollegeDeadlinesResponse(BaseModel):
    college_name: str
    source_url: str | None = None
    deadline_early_action: str | None = None
    deadline_early_decision: str | None = None
    deadline_regular: str | None = None
    application_timing: str | None = None
    deadlines_updated_at: str | None = None
    warnings: list[str] = Field(default_factory=list)
    searched: bool = False
