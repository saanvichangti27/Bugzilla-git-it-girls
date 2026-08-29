from fastapi import APIRouter, Query, Depends
from typing import Optional
from app.schemas.event import EventListResponse
from app.db.database import db
from app.auth.dependencies import get_current_user
from app.schemas.envelope import ResponseEnvelope

router = APIRouter(
    prefix="/events",
    tags=["events"]
)

@router.get("", response_model=ResponseEnvelope[EventListResponse])
def get_events(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    processed: Optional[bool] = Query(None, description="Filter by processed status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    items, total = db.get_events(
        event_type=event_type,
        processed=processed,
        page=page,
        page_size=page_size
    )
    return ResponseEnvelope.success(
        EventListResponse(
            items=items,
            page=page,
            total=total
        )
    )
