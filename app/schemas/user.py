from pydantic import BaseModel, EmailStr
from typing import Literal
from uuid import UUID
from datetime import datetime

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str
    created_at: datetime

class RoleUpdateRequest(BaseModel):
    role: Literal['reporter', 'developer', 'admin']
