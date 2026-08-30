"""
Notifications API — Priority 2e

Endpoints:
  GET  /notifications               — list notifications (optional ?unread_only=true)
  GET  /notifications/count         — unread count for bell badge
  PATCH /notifications/{id}/read    — mark one read
  PATCH /notifications/read-all     — mark all read
  GET  /notifications/preferences   — preference matrix
  PUT  /notifications/preferences   — bulk-update preferences
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.auth.dependencies import get_current_user, UserPayload
from app.db.database import db
from app.schemas.envelope import ResponseEnvelope

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class NotificationOut(BaseModel):
    id: str
    user_id: str
    event_type: str
    relationship: str
    title: str
    body: str = ""
    bug_id: Optional[str] = None
    read: bool
    created_at: str


class UnreadCountOut(BaseModel):
    count: int


class PreferenceOut(BaseModel):
    user_id: str
    event_type: str
    relationship: str
    channel: str
    enabled: bool


class PreferenceUpdateItem(BaseModel):
    event_type: str
    relationship: str
    channel: str
    enabled: bool


class PreferencesUpdateBody(BaseModel):
    preferences: List[PreferenceUpdateItem]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=ResponseEnvelope[List[NotificationOut]])
def get_notifications(
    unread_only: bool = Query(False),
    current_user: UserPayload = Depends(get_current_user),
):
    """Return notifications for the current user."""
    notifs = db.get_notifications(current_user.id, unread_only=unread_only)
    # Normalise missing fields for older in-memory records
    out = []
    for n in notifs:
        out.append(NotificationOut(
            id=n["id"],
            user_id=n.get("user_id", current_user.id),
            event_type=n.get("event_type", "system"),
            relationship=n.get("relationship", "reporter"),
            title=n.get("title") or n.get("message", ""),
            body=n.get("body", ""),
            bug_id=n.get("bug_id"),
            read=bool(n.get("read", False)),
            created_at=n["created_at"],
        ))
    return ResponseEnvelope.success(out)


@router.get("/count", response_model=ResponseEnvelope[UnreadCountOut])
def get_unread_count(current_user: UserPayload = Depends(get_current_user)):
    """Return the unread notification count — used by the bell badge."""
    count = db.get_unread_count(current_user.id)
    return ResponseEnvelope.success(UnreadCountOut(count=count))


@router.patch("/{notification_id}/read", response_model=ResponseEnvelope[NotificationOut])
def mark_read(notification_id: str, current_user: UserPayload = Depends(get_current_user)):
    n = db.mark_notification_read(notification_id, current_user.id)
    if not n:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Notification not found"})
    return ResponseEnvelope.success(NotificationOut(**n))


@router.patch("/read-all", response_model=ResponseEnvelope[dict])
def mark_all_read(current_user: UserPayload = Depends(get_current_user)):
    count = db.mark_all_notifications_read(current_user.id)
    return ResponseEnvelope.success({"marked_read": count})


@router.get("/preferences", response_model=ResponseEnvelope[List[PreferenceOut]])
def get_preferences(current_user: UserPayload = Depends(get_current_user)):
    prefs = db.get_notification_preferences(current_user.id)
    return ResponseEnvelope.success([PreferenceOut(**p) for p in prefs])


@router.put("/preferences", response_model=ResponseEnvelope[List[PreferenceOut]])
def update_preferences(
    body: PreferencesUpdateBody,
    current_user: UserPayload = Depends(get_current_user),
):
    updated = []
    for item in body.preferences:
        row = db.upsert_notification_preference(
            user_id=current_user.id,
            event_type=item.event_type,
            relationship=item.relationship,
            channel=item.channel,
            enabled=item.enabled,
        )
        updated.append(PreferenceOut(**row))
    return ResponseEnvelope.success(updated)
