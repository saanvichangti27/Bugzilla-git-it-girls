import asyncio
import logging
from app.db.database import db
from datetime import datetime, timezone

logger = logging.getLogger("dispatcher")

async def handle_github(event: dict):
    # TODO: Day 2 Integration
    pass

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
