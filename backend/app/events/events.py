import logging
from typing import Optional
from app.db.database import db

logger = logging.getLogger("events")

def log_event(event_type: str, bug_id: Optional[str], payload: dict) -> None:
    """
    Inserts a new event into the database to be processed asynchronously by the dispatcher.
    """
    try:
        db.create_event(event_type, bug_id, payload)
        logger.info(f"[EVENT LOGGED] event_type='{event_type}', bug_id='{bug_id}'")
    except Exception as e:
        logger.error(f"[EVENT ERROR] Failed to log event '{event_type}': {e}")
