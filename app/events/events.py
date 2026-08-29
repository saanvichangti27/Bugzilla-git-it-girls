import logging

logger = logging.getLogger("events")

def log_event(event_type: str, bug_id: str, payload: dict) -> None:
    """
    # TODO: replace with Person C's real implementation
    Phase 1 Stub for log_event. Person C will replace this function to insert events into Supabase table.
    """
    logger.info(f"[EVENT STUB] event_type='{event_type}', bug_id='{bug_id}', payload={payload}")
    print(f"[EVENT STUB] {event_type} | Bug: {bug_id} | Payload: {payload}")
