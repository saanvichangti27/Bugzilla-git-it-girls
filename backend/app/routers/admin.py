from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user, UserPayload
from app.db.database import db
from app.schemas.envelope import ResponseEnvelope

router = APIRouter(prefix="/admin", tags=["admin"])

def require_admin(current_user: UserPayload = Depends(get_current_user)):
    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only admins can access this endpoint."}
        )
    return current_user

@router.get("/role-permissions", response_model=ResponseEnvelope[List[Dict[str, Any]]])
def get_role_permissions(admin_user: UserPayload = Depends(require_admin)):
    perms = db.get_role_permissions()
    return ResponseEnvelope.success(perms)

@router.put("/role-permissions", response_model=ResponseEnvelope[List[Dict[str, Any]]])
def update_role_permissions(
    permissions: List[Dict[str, Any]],
    admin_user: UserPayload = Depends(require_admin)
):
    if db.use_supabase:
        try:
            # Delete all and insert new
            db.client.table("role_permissions").delete().neq("role", "impossible").execute()
            db.client.table("role_permissions").insert(permissions).execute()
        except Exception as e:
            print(f"[SUPABASE ERROR] update_role_permissions failed: {e}")
            raise HTTPException(status_code=500, detail="Database error updating permissions")
    
    db.role_permissions_db = permissions
    return ResponseEnvelope.success(permissions)


@router.get("/status-transitions", response_model=ResponseEnvelope[List[Dict[str, Any]]])
def get_status_transitions(admin_user: UserPayload = Depends(require_admin)):
    transitions = db.get_status_transitions()
    return ResponseEnvelope.success(transitions)

@router.put("/status-transitions", response_model=ResponseEnvelope[List[Dict[str, Any]]])
def update_status_transitions(
    transitions: List[Dict[str, Any]],
    admin_user: UserPayload = Depends(require_admin)
):
    if db.use_supabase:
        try:
            # Delete all and insert new
            db.client.table("status_transitions").delete().neq("role", "impossible").execute()
            db.client.table("status_transitions").insert(transitions).execute()
        except Exception as e:
            print(f"[SUPABASE ERROR] update_status_transitions failed: {e}")
            raise HTTPException(status_code=500, detail="Database error updating transitions")
            
    db.status_transitions_db = transitions
    return ResponseEnvelope.success(transitions)

@router.get("/automation-rules", response_model=ResponseEnvelope[List[Dict[str, Any]]])
def get_automation_rules(admin_user: UserPayload = Depends(require_admin)):
    rules = db.get_automation_rules()
    return ResponseEnvelope.success(rules)

@router.put("/automation-rules", response_model=ResponseEnvelope[List[Dict[str, Any]]])
def update_automation_rules(
    rules: List[Dict[str, Any]],
    admin_user: UserPayload = Depends(require_admin)
):
    if db.use_supabase:
        try:
            # Delete all and insert new
            db.client.table("automation_rules").delete().neq("id", "impossible").execute()
            db.client.table("automation_rules").insert(rules).execute()
        except Exception as e:
            print(f"[SUPABASE ERROR] update_automation_rules failed: {e}")
            raise HTTPException(status_code=500, detail="Database error updating automation rules")
            
    db.automation_rules_db = rules
    return ResponseEnvelope.success(rules)
