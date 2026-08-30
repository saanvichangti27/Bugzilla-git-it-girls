from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import Optional, List
from app.schemas.user import UserResponse, RoleUpdateRequest, UserGitHubSettingsUpdate
from app.schemas.envelope import ResponseEnvelope
from app.db.database import db
from app.auth.dependencies import require_role, get_current_user, UserPayload
from app.events.events import log_event
from app.services.github import setup_repository_webhook
from app.config import settings

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.get("", response_model=ResponseEnvelope[List[UserResponse]])
def get_users(search: Optional[str] = Query(None)):
    users = db.search_users(search)
    return ResponseEnvelope.success([UserResponse(**u) for u in users])

@router.patch("/{user_id}/role", response_model=ResponseEnvelope[UserResponse])
def update_user_role(
    user_id: str, 
    body: RoleUpdateRequest,
    current_admin=Depends(require_role(["admin"]))
):
    user_doc = db.get_user_by_id(user_id)
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "USER_NOT_FOUND", "message": "User not found"})
    
    old_role = user_doc["role"]
    updated_user = db.update_user_role(user_id, body.role)
    
    # Log event
    log_event("user.role_changed", None, {
        "user_id": user_id,
        "old_role": old_role,
        "new_role": body.role
    })
    
    return ResponseEnvelope.success(UserResponse(**updated_user))

@router.patch("/me/github", response_model=ResponseEnvelope[UserResponse])
def update_github_settings(
    body: UserGitHubSettingsUpdate,
    current_user: UserPayload = Depends(get_current_user)
):
    updated_user = db.update_user_github_settings(
        current_user.id,
        body.github_token,
        body.github_username,
        body.github_repo
    )
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "USER_NOT_FOUND", "message": "User not found"})
        
    log_event("user.github_settings_updated", None, {
        "user_id": current_user.id,
        "github_repo": body.github_repo
    })
    
    # Try to setup the webhook for their repo. 
    app_webhook_url = f"{settings.BACKEND_PUBLIC_URL}/api/v1/webhooks/github" 
    setup_repository_webhook(body.github_token, body.github_repo, app_webhook_url)

    return ResponseEnvelope.success(UserResponse(**updated_user))

from app.schemas.user import UserUpdateRequest

@router.patch("/me", response_model=ResponseEnvelope[UserResponse])
def update_me(
    body: UserUpdateRequest,
    current_user: UserPayload = Depends(get_current_user)
):
    user_doc = db.get_user_by_id(current_user.id)
    if not user_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "USER_NOT_FOUND", "message": "User not found"})
    
    updated_user = db.update_user_discord(current_user.id, body.discord_username)
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"code": "UPDATE_FAILED", "message": "Failed to update user"})
    
    return ResponseEnvelope.success(UserResponse(**updated_user))

