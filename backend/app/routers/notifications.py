from typing import List
from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user, UserPayload
from app.db.database import db
from app.schemas.envelope import ResponseEnvelope
from pydantic import BaseModel
import uuid
from datetime import datetime, timezone

router = APIRouter(prefix="/notifications", tags=["notifications"])

class Notification(BaseModel):
    id: str
    user_id: str
    message: str
    read: bool
    created_at: str

# In-memory storage for notifications
notifications_db = []

@router.get("", response_model=ResponseEnvelope[List[Notification]])
def get_notifications(current_user: UserPayload = Depends(get_current_user)):
    user_notifs = [n for n in notifications_db if n["user_id"] == current_user.id]
    user_notifs.sort(key=lambda x: x["created_at"], reverse=True)
    return ResponseEnvelope.success(user_notifs)

@router.post("/{notification_id}/read", response_model=ResponseEnvelope[Notification])
def mark_read(notification_id: str, current_user: UserPayload = Depends(get_current_user)):
    for n in notifications_db:
        if n["id"] == notification_id and n["user_id"] == current_user.id:
            n["read"] = True
            return ResponseEnvelope.success(n)
    
    return ResponseEnvelope.error("NOT_FOUND", "Notification not found")

def create_notification(user_id: str, message: str):
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "message": message,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    notifications_db.append(notif)
    return notif
