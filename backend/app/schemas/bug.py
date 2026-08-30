from enum import Enum
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class PriorityEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class SeverityEnum(str, Enum):
    TRIVIAL = "trivial"
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"
    BLOCKER = "blocker"

class StatusEnum(str, Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    READY_FOR_TESTING = "ready_for_testing"
    RESOLVED = "resolved"
    CLOSED = "closed"

class UserSummary(BaseModel):
    id: str
    name: str

class Attachment(BaseModel):
    id: str
    file_name: str
    file_url: str
    file_type: Optional[str] = "file"
    file_size: Optional[int] = 0
    uploaded_at: Optional[str] = None

class BugCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    priority: PriorityEnum
    severity: SeverityEnum
    component: str = Field(..., min_length=1)
    assignee_id: Optional[str] = None
    attachments: Optional[List[Attachment]] = []

class BugUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[PriorityEnum] = None
    severity: Optional[SeverityEnum] = None
    component: Optional[str] = None
    status: Optional[StatusEnum] = None
    assignee_id: Optional[str] = None
    attachments: Optional[List[Attachment]] = None

class BugListItem(BaseModel):
    id: str
    title: str
    status: StatusEnum
    priority: PriorityEnum
    severity: SeverityEnum
    component: str
    assignee: Optional[UserSummary] = None
    created_at: datetime
    updated_at: datetime
    attachments: Optional[List[Attachment]] = []
    followers_count: Optional[int] = 0
    is_following: Optional[bool] = False

class BugListResponse(BaseModel):
    items: List[BugListItem]
    page: int
    page_size: int
    total: int

class PossibleDuplicate(BaseModel):
    bug_id: str
    title: Optional[str] = None
    reason: str


class BugResponse(BaseModel):
    id: str
    title: str
    description: str
    status: StatusEnum
    priority: PriorityEnum
    severity: SeverityEnum
    component: str
    assignee: Optional[UserSummary] = None
    reporter: UserSummary
    created_at: datetime
    updated_at: datetime
    github_issue_id: Optional[str] = None
    github_issue_url: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_summary_generated_at: Optional[datetime] = None
    possible_duplicate: Optional[PossibleDuplicate] = None
    attachments: Optional[List[Attachment]] = []
    followers: Optional[List[str]] = []
    followers_count: Optional[int] = 0
    is_following: Optional[bool] = False

class SuggestFieldsRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)

class SuggestFieldsResponse(BaseModel):
    component: str
    priority: PriorityEnum
    severity: SeverityEnum

class SummarizeResponse(BaseModel):
    ai_summary: str
    generated_at: datetime
