import asyncio
import logging
import httpx
from app.db.database import db
from app.config import settings
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

async def handle_discord(event: dict):
    if not settings.DISCORD_WEBHOOK_URL:
        return
        
    event_type = event.get("event_type")
    payload = event.get("payload_json", {})
    
    if event_type not in ["bug.created", "bug.status_changed", "bug.resolved"]:
        return
        
    title = payload.get("title", "Unknown Bug")
    message_content = f"**Event:** {event_type}\n**Bug:** {title}"
    
    # Try to mention the user if they linked their Discord
    user_id = payload.get("reporter_id") or payload.get("updated_by")
    if user_id:
        user_doc = db.get_user_by_id(user_id)
        if user_doc and user_doc.get("discord_username"):
            discord_user = user_doc["discord_username"]
            # Ensure it is mentioned if it is an ID or format it if it's a string
            mention = f"@{discord_user}" if not discord_user.startswith("<@") else discord_user
            message_content += f"\n**By:** {mention}"
    
    if event_type == "bug.created":
        priority = payload.get("priority", "unknown")
        if priority != "critical":
            return # Only notify on critical bugs
        message_content += f"\n**Priority:** {priority}"
    elif event_type == "bug.status_changed":
        new_status = payload.get("to", "unknown")
        message_content += f"\n**New Status:** {new_status}"
        
    # Determine which webhook URL to use based on event type
    webhook_url = settings.DISCORD_WEBHOOK_URL
    
    if event_type == "bug.created" and settings.DISCORD_CREATED_WEBHOOK_URL:
        webhook_url = settings.DISCORD_CREATED_WEBHOOK_URL
    elif event_type == "bug.status_changed" and settings.DISCORD_RESOLVED_WEBHOOK_URL:
        webhook_url = settings.DISCORD_RESOLVED_WEBHOOK_URL
        
    if not webhook_url:
        return
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json={"content": message_content},
                timeout=5.0
            )
            response.raise_for_status()
            logger.info(f"Discord notification sent for event {event['id']}")
    except Exception as e:
        logger.error(f"Failed to send Discord notification for event {event['id']}: {e}")

async def handle_ai(event: dict):
    # TODO: Day 2 Integration
    pass

async def process_event(event: dict):
    event_type = event.get("event_type")
    
    # Route by event type
    try:
        if event_type == "bug.created":
            await handle_github(event)
            await handle_discord(event)
        elif event_type == "bug.status_changed":
            await handle_discord(event)
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
        await asyncio.sleep(1)

def start_dispatcher():
    # Helper to start the background task
    asyncio.create_task(dispatcher_loop())
