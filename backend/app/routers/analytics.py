from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user, UserPayload
from app.db.database import db
from app.schemas.envelope import ResponseEnvelope
import datetime

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/overview", response_model=ResponseEnvelope[Dict[str, Any]])
def get_analytics_overview(current_user: UserPayload = Depends(get_current_user)):
    return ResponseEnvelope.success(db.get_analytics_overview())
