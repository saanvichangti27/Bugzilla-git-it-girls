from fastapi import APIRouter, Depends
from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.envelope import ResponseEnvelope
from app.db.database import db
from app.auth.dependencies import get_current_user, UserPayload

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"]
)

@router.get("/summary", response_model=ResponseEnvelope[DashboardSummaryResponse])
def get_dashboard_summary(current_user: UserPayload = Depends(get_current_user)):
    summary = db.get_dashboard_summary(current_user.id)
    return ResponseEnvelope.success(DashboardSummaryResponse(**summary))
