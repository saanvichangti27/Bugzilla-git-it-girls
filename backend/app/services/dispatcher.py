import asyncio
import logging
from app.db.database import db
from datetime import datetime, timezone

logger = logging.getLogger("dispatcher")

async def handle_github(event: dict):
    """
    On a bug.created event, create a matching GitHub issue via PyGithub.
    Runs in the background dispatcher — any failure must NOT propagate.
    """
    try:
        from app.services.github_service import create_github_issue
        from app.config import settings

        payload = event.get("payload") or {}
        bug_id = event.get("bug_id")

        if not bug_id:
            return

        # Fetch full bug record to get title + description
        raw_bug = db.get_bug(bug_id)
        if not raw_bug:
            logger.warning(f"[GITHUB DISPATCHER] Bug {bug_id} not found; skipping issue creation.")
            return

        result = create_github_issue(
            bug_id=bug_id,
            title=raw_bug.get("title", ""),
            description=raw_bug.get("description", ""),
            frontend_url=settings.APP_FRONTEND_URL,
        )

        if result:
            # Persist github_issue_id / github_issue_url back onto the bug
            db.update_bug(bug_id, {
                "github_issue_id": result["github_issue_id"],
                "github_issue_url": result["github_issue_url"],
            })
            # Log a canonical event for audit trail
            db.create_event(
                "github.issue_created",
                bug_id,
                {
                    "github_issue_id": result["github_issue_id"],
                    "github_issue_url": result["github_issue_url"],
                }
            )
            logger.info(f"[GITHUB DISPATCHER] Issue #{result['github_issue_id']} linked to bug {bug_id}.")

    except Exception as exc:
        logger.error(f"[GITHUB DISPATCHER] Unhandled error for event {event.get('id')}: {exc!r}")

async def handle_slack(event: dict):
    # TODO: Day 2 Integration
    pass

async def handle_ai(event: dict):
    # TODO: Day 2 Integration
    pass

async def process_event(event: dict):
    event_type = event.get("event_type")
    
    # Route by event type
    try:
        if event_type == "bug.created":
            await handle_github(event)
            await handle_slack(event)
        elif event_type == "bug.status_changed":
            await handle_slack(event)
        elif event_type == "github.pr_merged":
            pass # internally handled in github webhook usually, but dispatcher might have logic
        
        # Mark as processed after all handlers succeed
        db.mark_event_processed(event["id"])
        logger.info(f"Processed event {event['id']} ({event_type})")
        
    except Exception as e:
        logger.error(f"Failed to process event {event['id']}: {e}")

async def dispatcher_loop():
    logger.info("Event Dispatcher started.")
    while True:
        try:
            unprocessed_events = db.get_unprocessed_events()
            for event in unprocessed_events:
                await process_event(event)
        except Exception as e:
            logger.error(f"Error in dispatcher loop: {e}")
        
        # Wait before polling again
        await asyncio.sleep(5)

def start_dispatcher():
    # Helper to start the background task
    asyncio.create_task(dispatcher_loop())
