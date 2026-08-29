from fastapi import APIRouter, Query, Depends
from typing import Optional
from app.schemas.webhook_log import WebhookLogListResponse
from app.db.database import db
from app.auth.dependencies import get_current_user
from app.schemas.envelope import ResponseEnvelope

router = APIRouter(
    prefix="/webhook-logs",
    tags=["webhook-logs"]
)

@router.get("", response_model=ResponseEnvelope[WebhookLogListResponse])
def get_webhook_logs(
    destination: Optional[str] = Query(None, description="Filter by destination (slack, github)"),
    success: Optional[bool] = Query(None, description="Filter by success status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    items, total = db.get_webhook_logs(
        destination=destination,
        success=success,
        page=page,
        page_size=page_size
    )
    return ResponseEnvelope.success(
        WebhookLogListResponse(
            items=items,
            page=page,
            total=total
        )
    )
