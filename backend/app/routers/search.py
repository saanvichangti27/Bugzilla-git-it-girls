from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from app.auth.dependencies import get_current_user, UserPayload
from app.db.database import db
from app.schemas.envelope import ResponseEnvelope
from app.schemas.bug import BugListItem

router = APIRouter(prefix="/search", tags=["search"])

def _format_bug_list_item(raw: dict) -> BugListItem:
    from app.schemas.bug import UserSummary
    assignee = None
    if raw.get("assignee_id"):
        assignee = UserSummary(
            id=raw.get("assignee_id"),
            name=raw.get("assignee_name") or "Assigned User"
        )
    return BugListItem(
        id=raw["id"],
        title=raw["title"],
        status=raw.get("status", "new"),
        priority=raw["priority"],
        severity=raw["severity"],
        component=raw["component"],
        assignee=assignee,
        created_at=raw["created_at"],
        updated_at=raw["updated_at"]
    )

@router.get("", response_model=ResponseEnvelope[List[BugListItem]])
def search_bugs(
    q: str = Query(..., min_length=2),
    current_user: UserPayload = Depends(get_current_user)
):
    query_lower = q.lower()
    
    if db.use_supabase:
        try:
            # We want to search bugs.title, bugs.description, and comments.body
            # For simplicity in Supabase without a custom RPC, we search title and description
            # in bugs table directly. A robust implementation would use a textSearch or a Postgres function.
            res = db.client.table("bugs").select("*").or_(f"title.ilike.%{query_lower}%,description.ilike.%{query_lower}%").execute()
            bugs = res.data or []
            
            # Search comments
            c_res = db.client.table("comments").select("bug_id").ilike("body", f"%{query_lower}%").execute()
            if c_res.data:
                bug_ids = list(set([c["bug_id"] for c in c_res.data]))
                if bug_ids:
                    # Fetch bugs for these comments if not already found
                    found_ids = [b["id"] for b in bugs]
                    missing_ids = [id for id in bug_ids if id not in found_ids]
                    if missing_ids:
                        b_res = db.client.table("bugs").select("*").in_("id", missing_ids).execute()
                        if b_res.data:
                            bugs.extend(b_res.data)
            
            items = [_format_bug_list_item(b) for b in bugs]
            return ResponseEnvelope.success(items)
            
        except Exception as e:
            print(f"[SUPABASE ERROR] search_bugs failed: {e}. Falling back to memory.")
    
    # In-memory search
    results = []
    
    # Search bugs
    for bug in db.bugs_db.values():
        if query_lower in bug.get("title", "").lower() or query_lower in bug.get("description", "").lower():
            results.append(bug)
            continue
            
        # Search comments for this bug
        comments = db.comments_db.get(bug["id"], [])
        for comment in comments:
            if query_lower in comment.get("body", "").lower():
                results.append(bug)
                break
                
    # Format results
    items = [_format_bug_list_item(b) for b in results]
    return ResponseEnvelope.success(items)
