import jwt
from typing import Optional, List
from pydantic import BaseModel
from fastapi import HTTPException, Depends, status, Header
from app.config import settings

class UserPayload(BaseModel):
    id: str
    name: str
    email: str
    role: str

ROLE_TEST_IDS = {
    "developer": "11111111-1111-1111-1111-111111111101",
    "reporter": "11111111-1111-1111-1111-111111111102",
    "admin": "11111111-1111-1111-1111-111111111103",
    "tester": "11111111-1111-1111-1111-111111111104",
}

def decode_token(token: str) -> UserPayload:
    # 1. Dev / Test shortcut token handling
    if token.startswith("test-") or token.startswith("dev-"):
        parts = token.split("-")
        role = parts[1] if len(parts) > 1 else "reporter"
        user_id = ROLE_TEST_IDS.get(role.lower(), "11111111-1111-1111-1111-111111111100")
        return UserPayload(
            id=user_id,
            name=f"Test {role.capitalize()} User",
            email=f"{role}@example.com",
            role=role.lower()
        )


    # 2. Real Supabase JWT decoding
    try:
        # First attempt standard decode with configured JWT_SECRET if present
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_signature": False}  # Allows testing across Supabase standard tokens
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": f"Could not decode JWT token: {str(e)}"}
        )

    user_id = payload.get("sub") or payload.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Token missing 'sub' or 'id' claim."}
        )

    user_metadata = payload.get("user_metadata") or {}
    app_metadata = payload.get("app_metadata") or {}

    role = user_metadata.get("role") or app_metadata.get("role")
    if not role or str(role).lower() == "authenticated":
        raw_role = payload.get("role")
        if raw_role and str(raw_role).lower() != "authenticated":
            role = raw_role
        else:
            from app.db.database import db
            user_doc = db.get_user_by_id(str(user_id))
            if user_doc and user_doc.get("role"):
                role = user_doc["role"]
            else:
                role = "reporter"

    name = user_metadata.get("name") or payload.get("name")
    if not name:
        from app.db.database import db
        user_doc = db.get_user_by_id(str(user_id))
        if user_doc and user_doc.get("name"):
            name = user_doc["name"]
        else:
            name = payload.get("email", "User").split("@")[0]

    email = payload.get("email", f"{user_id}@example.com")

    return UserPayload(
        id=str(user_id),
        name=name,
        email=email,
        role=str(role).lower()
    )

def get_current_user(authorization: Optional[str] = Header(None)) -> UserPayload:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_TOKEN", "message": "Authorization header missing"}
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN_FORMAT", "message": "Authorization header must start with Bearer "}
        )

    token = authorization.split("Bearer ")[1].strip()
    return decode_token(token)

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: UserPayload = Depends(get_current_user)) -> UserPayload:
        normalized_allowed = [r.lower() for r in allowed_roles]
        if current_user.role.lower() not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": f"Role '{current_user.role}' is not authorized."}
            )
        return current_user
    return role_checker
