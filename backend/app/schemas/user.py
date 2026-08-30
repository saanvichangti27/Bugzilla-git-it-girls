from pydantic import BaseModel, EmailStr
from typing import Literal, Optional
from uuid import UUID
from datetime import datetime

class UserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str
    created_at: datetime
    discord_username: Optional[str] = None

class UserUpdateRequest(BaseModel):
    discord_username: Optional[str] = None

class RoleUpdateRequest(BaseModel):
    role: Literal['reporter', 'tester', 'developer', 'admin']

class UserGitHubSettingsUpdate(BaseModel):
    github_token: str
    github_username: str
    github_repo: str
