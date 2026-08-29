from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from uuid import UUID

class EventResponse(BaseModel):
    id: UUID
    event_type: str
    bug_id: Optional[UUID] = None
    payload_json: Dict[str, Any]
    processed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class EventListResponse(BaseModel):
    items: List[EventResponse]
    page: int
    total: int
