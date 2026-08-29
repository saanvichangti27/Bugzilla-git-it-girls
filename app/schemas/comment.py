from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.bug import UserSummary

class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1)

class CommentResponse(BaseModel):
    id: str
    body: str
    user: UserSummary
    created_at: datetime
