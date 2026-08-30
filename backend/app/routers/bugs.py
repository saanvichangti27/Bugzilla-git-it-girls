import os
import uuid
import shutil
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from app.auth.dependencies import get_current_user, UserPayload
from app.db.database import db
from app.events.events import log_event
from app.schemas.envelope import ResponseEnvelope, ErrorDetail
from app.schemas.bug import (
    BugCreate,
    BugUpdate,
    BugResponse,
    BugListItem,
    BugListResponse,
    UserSummary,
    StatusEnum,
    PriorityEnum,
    SeverityEnum,
    PossibleDuplicate,
    SuggestFieldsRequest,
    SuggestFieldsResponse,
    SummarizeResponse,
    Attachment,
)
from app.services.ai_service import generate_bug_summary, detect_duplicate_bug, suggest_bug_fields

router = APIRouter(prefix="/bugs", tags=["bugs"])

def _format_bug_response(raw: dict, current_user_id: Optional[str] = None) -> BugResponse:
    assignee = None
    if raw.get("assignee_id"):
        assignee = UserSummary(
            id=raw.get("assignee_id"),
            name=raw.get("assignee_name") or "Assigned User"
        )

    reporter = UserSummary(
        id=raw.get("reporter_id", "unknown-id"),
        name=raw.get("reporter_name", "Reporter User")
    )

    raw_attachments = raw.get("attachments") or []
    attachments = [Attachment(**a) if isinstance(a, dict) else a for a in raw_attachments]
    followers = raw.get("followers") or []
    is_following = bool(current_user_id and current_user_id in followers)

    return BugResponse(
        id=raw["id"],
        title=raw["title"],
        description=raw.get("description", ""),
        status=raw.get("status", StatusEnum.NEW.value),
        priority=raw["priority"],
        severity=raw["severity"],
        component=raw["component"],
        assignee=assignee,
        reporter=reporter,
        created_at=raw["created_at"],
        updated_at=raw["updated_at"],
        github_issue_id=raw.get("github_issue_id"),
        github_issue_url=raw.get("github_issue_url"),
        ai_summary=raw.get("ai_summary"),
        ai_summary_generated_at=raw.get("ai_summary_generated_at"),
        attachments=attachments,
        followers=followers,
        followers_count=len(followers),
        is_following=is_following
    )

def _format_bug_list_item(raw: dict, current_user_id: Optional[str] = None) -> BugListItem:
    assignee = None
    if raw.get("assignee_id"):
        assignee = UserSummary(
            id=raw.get("assignee_id"),
            name=raw.get("assignee_name") or "Assigned User"
        )
    raw_attachments = raw.get("attachments") or []
    attachments = [Attachment(**a) if isinstance(a, dict) else a for a in raw_attachments]
    followers = raw.get("followers") or []
    is_following = bool(current_user_id and current_user_id in followers)
    return BugListItem(
        id=raw["id"],
        title=raw["title"],
        status=raw.get("status", StatusEnum.NEW.value),
        priority=raw["priority"],
        severity=raw["severity"],
        component=raw["component"],
        assignee=assignee,
        created_at=raw["created_at"],
        updated_at=raw["updated_at"],
        attachments=attachments,
        followers_count=len(followers),
        is_following=is_following
    )

@router.get("/similar", response_model=ResponseEnvelope[List[BugListItem]])
def search_similar(
    q: str = Query("", alias="q"),
    current_user: UserPayload = Depends(get_current_user)
):
    raw_items = db.search_similar_bugs(q, limit=15)
    items = [_format_bug_list_item(b, current_user.id) for b in raw_items]
    return ResponseEnvelope.success(items)

@router.post("/upload", response_model=ResponseEnvelope[Attachment])
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: UserPayload = Depends(get_current_user)
):
    upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
    os.makedirs(upload_dir, exist_ok=True)
    
    file_id = str(uuid.uuid4())
    filename = f"{file_id}_{file.filename}"
    filepath = os.path.join(upload_dir, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_size = os.path.getsize(filepath)
    file_url = f"/uploads/{filename}"
    now = datetime.now(timezone.utc).isoformat()
    
    attachment = Attachment(
        id=file_id,
        file_name=file.filename,
        file_url=file_url,
        file_type=file.content_type or "file",
        file_size=file_size,
        uploaded_at=now
    )
    return ResponseEnvelope.success(attachment)

@router.post("/{bug_id}/follow", response_model=ResponseEnvelope[BugResponse])
def follow_bug(
    bug_id: str,
    current_user: UserPayload = Depends(get_current_user)
):
    raw_bug = db.follow_bug(bug_id, current_user.id)
    if not raw_bug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BUG_NOT_FOUND", "message": f"Bug '{bug_id}' does not exist"}
        )
    return ResponseEnvelope.success(_format_bug_response(raw_bug, current_user.id))

@router.post("/{bug_id}/unfollow", response_model=ResponseEnvelope[BugResponse])
def unfollow_bug(
    bug_id: str,
    current_user: UserPayload = Depends(get_current_user)
):
    raw_bug = db.unfollow_bug(bug_id, current_user.id)
    if not raw_bug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BUG_NOT_FOUND", "message": f"Bug '{bug_id}' does not exist"}
        )
    return ResponseEnvelope.success(_format_bug_response(raw_bug, current_user.id))

@router.get("", response_model=ResponseEnvelope[BugListResponse])
def list_bugs(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    severity_filter: Optional[str] = Query(None, alias="severity"),
    component_filter: Optional[str] = Query(None, alias="component"),
    assignee_id: Optional[str] = Query(None),
    reporter_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: Optional[str] = Query("-created_at"),
    current_user: UserPayload = Depends(get_current_user)
):
    raw_items, total = db.get_bugs(
        status=status_filter,
        priority=priority_filter,
        severity=severity_filter,
        component=component_filter,
        assignee_id=assignee_id,
        reporter_id=reporter_id,
        page=page,
        page_size=page_size,
        sort=sort
    )

    items = [_format_bug_list_item(b, current_user.id) for b in raw_items]
    response_data = BugListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total
    )
    return ResponseEnvelope.success(response_data)

@router.post("/suggest-fields", response_model=ResponseEnvelope[SuggestFieldsResponse])
def suggest_fields(
    request_in: SuggestFieldsRequest,
    current_user: UserPayload = Depends(get_current_user)
):
    result = suggest_bug_fields(request_in.title, request_in.description)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "AI_PROVIDER_ERROR", "message": "Failed to suggest fields via AI provider"}
        )
    return ResponseEnvelope.success(SuggestFieldsResponse(
        component=result["component"],
        priority=PriorityEnum(result["priority"]),
        severity=SeverityEnum(result["severity"])
    ))

@router.post("", response_model=ResponseEnvelope[BugResponse], status_code=status.HTTP_201_CREATED)
def create_bug(
    bug_in: BugCreate,
    current_user: UserPayload = Depends(get_current_user)
):
    reporter = UserSummary(id=current_user.id, name=current_user.name)
    bug_data = bug_in.model_dump()
    bug_data["assignee_id"] = None
    raw_bug = db.create_bug(bug_data, reporter=reporter)

    # Non-blocking Duplicate Bug Detection
    possible_dup = None
    try:
        open_bugs = db.get_open_bugs(limit=50)
        filtered_open = [b for b in open_bugs if str(b.get("id")) != str(raw_bug.get("id"))]
        dup_info = detect_duplicate_bug(bug_in.title, bug_in.description, filtered_open)
        if dup_info:
            possible_dup = PossibleDuplicate(
                bug_id=dup_info["bug_id"],
                reason=dup_info["reason"]
            )
    except Exception as exc:
        import logging
        logging.getLogger("bugs_router").warning(f"[AI DUPLICATE DETECT] Failed silently: {exc!r}")

    # Trigger log_event for bug creation
    log_event(
        event_type="bug.created",
        bug_id=raw_bug["id"],
        payload={
            "title": raw_bug["title"],
            "component": raw_bug["component"],
            "reporter_id": current_user.id,
            "priority": raw_bug["priority"]
        }
    )

    formatted = _format_bug_response(raw_bug, current_user.id)
    if possible_dup:
        formatted.possible_duplicate = possible_dup

    return ResponseEnvelope.success(formatted)

@router.post("/{bug_id}/summarize", response_model=ResponseEnvelope[SummarizeResponse])
def summarize_bug(
    bug_id: str,
    current_user: UserPayload = Depends(get_current_user)
):
    raw_bug = db.get_bug(bug_id)
    if not raw_bug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BUG_NOT_FOUND", "message": f"Bug '{bug_id}' does not exist"}
        )

    comments = db.get_comments(bug_id)
    summary = generate_bug_summary(raw_bug.get("title", ""), raw_bug.get("description", ""), comments)

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "AI_PROVIDER_ERROR", "message": "Failed to generate AI summary"}
        )

    now = datetime.now(timezone.utc)
    db.update_bug(bug_id, {
        "ai_summary": summary,
        "ai_summary_generated_at": now.isoformat()
    })

    return ResponseEnvelope.success(SummarizeResponse(
        ai_summary=summary,
        generated_at=now
    ))

@router.get("/{bug_id}", response_model=ResponseEnvelope[BugResponse])
def get_bug(
    bug_id: str,
    current_user: UserPayload = Depends(get_current_user)
):
    raw_bug = db.get_bug(bug_id)
    if not raw_bug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BUG_NOT_FOUND", "message": f"Bug '{bug_id}' does not exist"}
        )
    return ResponseEnvelope.success(_format_bug_response(raw_bug, current_user.id))

@router.patch("/{bug_id}", response_model=ResponseEnvelope[BugResponse])
def update_bug(
    bug_id: str,
    bug_update: BugUpdate,
    current_user: UserPayload = Depends(get_current_user)
):
    raw_bug = db.get_bug(bug_id)
    if not raw_bug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BUG_NOT_FOUND", "message": f"Bug '{bug_id}' does not exist"}
        )

    # Permission Checks
    role = current_user.role.lower()
    provided_fields = bug_update.model_dump(exclude_unset=True)

    if not provided_fields:
        return ResponseEnvelope.success(_format_bug_response(raw_bug, current_user.id))

    if role == "tester":
        disallowed_fields = set(provided_fields.keys()) - {"status", "assignee_id"}
        if disallowed_fields:
            is_reporter = raw_bug.get("reporter_id") == current_user.id
            if is_reporter and raw_bug.get("status") == StatusEnum.NEW.value:
                disallowed_fields = disallowed_fields - {"title", "description"}
            if disallowed_fields:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "FORBIDDEN", "message": f"Testers can only update status and assignee_id (or title/description on own new bugs). Disallowed: {', '.join(sorted(disallowed_fields))}"}
                )
    elif role == "reporter":
        if raw_bug.get("reporter_id") != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Reporters can only edit bugs they reported."}
            )
        if raw_bug.get("status") != StatusEnum.NEW.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Reporters can only edit bugs while status is 'new'."}
            )
        disallowed_fields = set(provided_fields.keys()) - {"title", "description"}
        if disallowed_fields:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": f"Reporters are not permitted to edit fields: {', '.join(sorted(disallowed_fields))}"
                }
            )
    elif role == "developer":
        # Developers may update any field, but status transitions are restricted:
        # they can only move bugs to in_progress or ready_for_testing.
        if "status" in provided_fields:
            allowed_transitions = {StatusEnum.IN_PROGRESS.value, StatusEnum.READY_FOR_TESTING.value}
            new_status = provided_fields["status"]
            # Handle both enum value strings and StatusEnum instances
            new_status_val = new_status.value if hasattr(new_status, 'value') else new_status
            if new_status_val not in allowed_transitions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "code": "FORBIDDEN",
                        "message": f"Developers can only set status to 'in_progress' or 'ready_for_testing', not '{new_status_val}'."
                    }
                )
    elif role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": f"Role '{role}' is not authorized to edit bugs."}
        )

    # Resolve assignee_name if assignee_id is updated
    if "assignee_id" in provided_fields:
        assignee_id = provided_fields["assignee_id"]
        if assignee_id:
            user_doc = db.get_user_by_id(assignee_id)
            provided_fields["assignee_name"] = user_doc.get("name", "Assigned User") if user_doc else "Assigned User"
        else:
            provided_fields["assignee_name"] = None

    # Execute DB update
    old_status = raw_bug.get("status")
    updated_raw = db.update_bug(bug_id, provided_fields)

    # Side effect events
    if "status" in provided_fields and provided_fields["status"] != old_status:
        log_event(
            event_type="bug.status_changed",
            bug_id=bug_id,
            payload={
                "from": old_status,
                "to": provided_fields["status"],
                "updated_by": current_user.id
            }
        )

    other_changes = {k: v for k, v in provided_fields.items() if k != "status"}
    if other_changes:
        log_event(
            event_type="bug.updated",
            bug_id=bug_id,
            payload={
                "updated_fields": list(other_changes.keys()),
                "updated_by": current_user.id
            }
        )

    return ResponseEnvelope.success(_format_bug_response(updated_raw, current_user.id))
