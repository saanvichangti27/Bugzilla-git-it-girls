import re
from fastapi import APIRouter, Request, status
from app.db.database import db
from app.schemas.bug import StatusEnum
from app.events.events import log_event

router = APIRouter(
    prefix="/webhooks",
    tags=["webhooks"]
)

@router.post("/github", status_code=status.HTTP_200_OK)
async def github_webhook(request: Request):
    # In a real app we would verify the X-Hub-Signature-256 header here
    
    # Check if event is pull_request
    event_type = request.headers.get("X-GitHub-Event")
    if event_type != "pull_request":
        return {"msg": "Ignored"}
        
    try:
        payload = await request.json()
    except Exception:
        return {"msg": "Invalid JSON"}

    action = payload.get("action")
    pr = payload.get("pull_request", {})
    merged = pr.get("merged", False)
    
    # We only care when a PR is closed and actually merged
    if action == "closed" and merged:
        body_text = pr.get("body") or ""
        # Search for "Fixes #<bug_issue_id>"
        # Using a simple regex
        match = re.search(r'(?i)(fixes|closes|resolves)\s+#(\d+)', body_text)
        if match:
            issue_id = match.group(2)
            # Find the bug that corresponds to this GitHub issue ID
            bugs = list(db.bugs_db.values())
            for bug in bugs:
                if bug.get("github_issue_id") == issue_id:
                    # Resolve this bug
                    old_status = bug.get("status")
                    db.update_bug(bug["id"], {"status": StatusEnum.RESOLVED.value})
                    
                    log_event(
                        event_type="bug.status_changed",
                        bug_id=bug["id"],
                        payload={
                            "from": old_status,
                            "to": StatusEnum.RESOLVED.value,
                            "updated_by": "github-webhook",
                            "reason": f"Merged PR: {pr.get('html_url')}"
                        }
                    )
                    return {"msg": "Bug resolved", "bug_id": bug["id"]}

    return {"msg": "No action taken"}
