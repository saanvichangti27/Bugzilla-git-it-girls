from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from uuid import UUID

class WebhookLogResponse(BaseModel):
    id: UUID
    event_type: str
    destination: str
    status_code: Optional[int] = None
    success: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class WebhookLogListResponse(BaseModel):
    items: List[WebhookLogResponse]
    page: int
    total: int
