from fastapi import APIRouter, HTTPException, Depends, status
from app.schemas.auth import SignupRequest, LoginRequest, AuthResponseData, AuthUserResponse
from app.schemas.envelope import ResponseEnvelope
from app.db.database import db
from app.auth.dependencies import get_current_user, UserPayload
from app.config import settings
import jwt
from datetime import datetime, timezone, timedelta

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

def _generate_test_token(user_id: str, email: str, role: str) -> str:
    # Used as a fallback if not using real Supabase auth
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

@router.post("/signup", response_model=ResponseEnvelope[AuthResponseData], status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest):
    if db.use_supabase:
        try:
            res = db.client.auth.sign_up({
                "email": body.email,
                "password": body.password,
                "options": {
                    "data": {
                        "name": body.name
                    }
                }
            })
            if not res.user:
                raise HTTPException(status_code=400, detail={"code": "SIGNUP_FAILED", "message": "Signup failed without errors."})
            
            user_id = res.user.id
            token = res.session.access_token if res.session else _generate_test_token(user_id, body.email, "reporter")
        except Exception as e:
            raise HTTPException(status_code=400, detail={"code": "SIGNUP_FAILED", "message": str(e)})
    else:
        # Fallback memory implementation
        import uuid
        user_id = str(uuid.uuid4())
        token = _generate_test_token(user_id, body.email, "reporter")

    # Insert into our public.users table
    try:
        user_doc = db.create_user(user_id=user_id, name=body.name, email=body.email, role="reporter")
    except Exception:
        pass # In case trigger already handled it
        user_doc = db.get_user_by_id(user_id)
        if not user_doc:
            user_doc = {"id": user_id, "name": body.name, "email": body.email, "role": "reporter"}

    return ResponseEnvelope.success(
        AuthResponseData(
            user=AuthUserResponse(**user_doc),
            token=token
        )
    )

@router.post("/login", response_model=ResponseEnvelope[AuthResponseData])
def login(body: LoginRequest):
    if db.use_supabase:
        try:
            res = db.client.auth.sign_in_with_password({
                "email": body.email,
                "password": body.password
            })
            user_id = res.user.id
            token = res.session.access_token
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "INVALID_CREDENTIALS", "message": str(e)})
    else:
        # Fallback - just find user by email (insecure for real apps, fine for mem fallback)
        users = list(db.users_db.values())
        matched = [u for u in users if u["email"] == body.email]
        if not matched:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "INVALID_CREDENTIALS", "message": "User not found"})
        user_id = matched[0]["id"]
        token = _generate_test_token(user_id, body.email, matched[0]["role"])

    user_doc = db.get_user_by_id(user_id)
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "INVALID_CREDENTIALS", "message": "User not in public table"})

    return ResponseEnvelope.success(
        AuthResponseData(
            user=AuthUserResponse(**user_doc),
            token=token
        )
    )

@router.get("/me", response_model=ResponseEnvelope[AuthUserResponse])
def get_me(current_user: UserPayload = Depends(get_current_user)):
    user_doc = db.get_user_by_id(current_user.id)
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "USER_NOT_FOUND", "message": "User not found"})
    return ResponseEnvelope.success(AuthUserResponse(**user_doc))
