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
    import uuid
    # Sanitize and assign IDs to rules if missing
    for rule in rules:
        if not rule.get("id"):
            rule["id"] = str(uuid.uuid4())

    if db.use_supabase:
        try:
            # Fetch existing IDs to delete them explicitly (avoid non-UUID literal comparison)
            existing = db.client.table("automation_rules").select("id").execute()
            existing_ids = [r["id"] for r in (existing.data or [])]
            if existing_ids:
                db.client.table("automation_rules").delete().in_("id", existing_ids).execute()
            db.client.table("automation_rules").insert(rules).execute()
        except Exception as e:
            print(f"[SUPABASE ERROR] update_automation_rules failed: {e}")
            raise HTTPException(status_code=500, detail="Database error updating automation rules")
            
    # Store rules as a dictionary keyed by ID to match database.py schema
    db.automation_rules_db = {r["id"]: r for r in rules}
    return ResponseEnvelope.success(rules)

@router.post("/automation-rules", response_model=ResponseEnvelope[Dict[str, Any]])
def create_automation_rule(
    rule: Dict[str, Any],
    admin_user: UserPayload = Depends(require_admin)
):
    """Create a single automation rule."""
    created = db.create_automation_rule({**rule, "created_by": admin_user.id})
    return ResponseEnvelope.success(created)

@router.patch("/automation-rules/{rule_id}", response_model=ResponseEnvelope[Dict[str, Any]])
def patch_automation_rule(
    rule_id: str,
    updates: Dict[str, Any],
    admin_user: UserPayload = Depends(require_admin)
):
    """Partially update (e.g., toggle enabled) a single automation rule."""
    updated = db.update_automation_rule(rule_id, updates)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RULE_NOT_FOUND", "message": "Automation rule not found"}
        )
    return ResponseEnvelope.success(updated)

@router.delete("/automation-rules/{rule_id}", response_model=ResponseEnvelope[Dict[str, Any]])
def delete_automation_rule(
    rule_id: str,
    admin_user: UserPayload = Depends(require_admin)
):
    """Delete a single automation rule."""
    ok = db.delete_automation_rule(rule_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RULE_NOT_FOUND", "message": "Automation rule not found"}
        )
    return ResponseEnvelope.success({"deleted": rule_id})
