import asyncio
import logging
import httpx
from app.db.database import db
from app.config import settings
from datetime import datetime, timezone

logger = logging.getLogger("dispatcher")

async def handle_github(event: dict):
    # TODO: Day 2 Integration
    pass

async def handle_discord(event: dict):
    if not settings.DISCORD_WEBHOOK_URL:
        return
        
    event_type = event.get("event_type")
    payload = event.get("payload", {})
    
    if event_type not in ["bug.created", "bug.status_changed", "bug.resolved"]:
        return
        
    title = payload.get("title", "Unknown Bug")
    message_content = f"**Event:** {event_type}\n**Bug:** {title}"
    
    if event_type == "bug.created":
        priority = payload.get("priority", "unknown")
        if priority != "critical":
            return # Only notify on critical bugs
        message_content += f"\n**Priority:** {priority}"
    elif event_type == "bug.status_changed":
        new_status = payload.get("to", "unknown")
        message_content += f"\n**New Status:** {new_status}"
        
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                settings.DISCORD_WEBHOOK_URL,
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
        await asyncio.sleep(5)

def start_dispatcher():
    # Helper to start the background task
    asyncio.create_task(dispatcher_loop())
