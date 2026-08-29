from pydantic import BaseModel, EmailStr
from uuid import UUID

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthUserResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    role: str

class AuthResponseData(BaseModel):
    user: AuthUserResponse
    token: str
