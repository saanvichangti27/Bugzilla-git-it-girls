from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user, UserPayload
from app.db.database import db
from app.schemas.envelope import ResponseEnvelope
import datetime

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/overview", response_model=ResponseEnvelope[Dict[str, Any]])
def get_analytics_overview(current_user: UserPayload = Depends(get_current_user)):
    bugs = list(db.bugs_db.values())
    
    # We want to return data suitable for recharts
    # Example: Bug creation trend over the last 7 days
    today = datetime.datetime.now(datetime.timezone.utc).date()
    
    # Initialize trend array for last 7 days
    trend_data = {}
    for i in range(6, -1, -1):
        day = today - datetime.timedelta(days=i)
        trend_data[day.isoformat()] = {"date": day.strftime("%b %d"), "opened": 0, "resolved": 0}
        
    status_distribution = {}
    priority_distribution = {}
    
    for bug in bugs:
        # Status distribution
        st = bug.get("status", "unknown")
        status_distribution[st] = status_distribution.get(st, 0) + 1
        
        # Priority distribution
        pr = bug.get("priority", "unknown")
        priority_distribution[pr] = priority_distribution.get(pr, 0) + 1
        
        # Trend
        created_at_str = bug.get("created_at")
        if created_at_str:
            try:
                # Naive parse to date
                created_date = datetime.datetime.fromisoformat(created_at_str.replace('Z', '+00:00')).date()
                iso_date = created_date.isoformat()
                if iso_date in trend_data:
                    trend_data[iso_date]["opened"] += 1
            except ValueError:
                pass
                
        if st == "resolved" and bug.get("updated_at"):
            try:
                updated_date = datetime.datetime.fromisoformat(bug["updated_at"].replace('Z', '+00:00')).date()
                iso_date = updated_date.isoformat()
                if iso_date in trend_data:
                    trend_data[iso_date]["resolved"] += 1
            except ValueError:
                pass

    return ResponseEnvelope.success({
        "trend": list(trend_data.values()),
        "status_distribution": [{"name": k, "value": v} for k, v in status_distribution.items()],
        "priority_distribution": [{"name": k, "value": v} for k, v in priority_distribution.items()]
    })
