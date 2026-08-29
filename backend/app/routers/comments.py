from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.dependencies import get_current_user, UserPayload
from app.db.database import db
from app.events.events import log_event
from app.schemas.envelope import ResponseEnvelope
from app.schemas.bug import UserSummary
from app.schemas.comment import CommentCreate, CommentResponse

router = APIRouter(prefix="/bugs", tags=["comments"])

@router.get("/{bug_id}/comments", response_model=ResponseEnvelope[List[CommentResponse]])
def get_comments(
    bug_id: str,
    current_user: UserPayload = Depends(get_current_user)
):
    bug = db.get_bug(bug_id)
    if not bug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BUG_NOT_FOUND", "message": f"Bug '{bug_id}' does not exist"}
        )

    raw_comments = db.get_comments(bug_id)
    formatted = [
        CommentResponse(
            id=c["id"],
            body=c["body"],
            user=UserSummary(
                id=c.get("user_id", "unknown-user"),
                name=c.get("user_name", "User")
            ),
            created_at=c["created_at"]
        )
        for c in raw_comments
    ]
    return ResponseEnvelope.success(formatted)

@router.post("/{bug_id}/comments", response_model=ResponseEnvelope[CommentResponse], status_code=status.HTTP_201_CREATED)
def create_comment(
    bug_id: str,
    comment_in: CommentCreate,
    current_user: UserPayload = Depends(get_current_user)
):
    bug = db.get_bug(bug_id)
    if not bug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BUG_NOT_FOUND", "message": f"Bug '{bug_id}' does not exist"}
        )

    user_summary = UserSummary(id=current_user.id, name=current_user.name)
    raw_comment = db.create_comment(bug_id=bug_id, body=comment_in.body, user=user_summary)

    # Side effect event
    log_event(
        event_type="comment.added",
        bug_id=bug_id,
        payload={
            "comment_id": raw_comment["id"],
            "body": raw_comment["body"],
            "user_id": current_user.id
        }
    )

    formatted = CommentResponse(
        id=raw_comment["id"],
        body=raw_comment["body"],
        user=user_summary,
        created_at=raw_comment["created_at"]
    )
    return ResponseEnvelope.success(formatted)
