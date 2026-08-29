from pydantic import BaseModel

class DashboardSummaryResponse(BaseModel):
    open_bugs: int
    assigned_to_me: int
    resolved_this_week: int
