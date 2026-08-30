import logging
from app.db.database import db

logger = logging.getLogger("automation")

def evaluate_rules(event_type: str, bug_id: str, payload: dict):
    """
    Evaluate and execute automation rules when a bug event occurs.
    """
    rules = db.get_automation_rules()
    
    # We need the current bug state for condition evaluation
    bug = db.get_bug(bug_id)
    if not bug:
        return

    for rule in rules:
        if rule.get("trigger_event") != event_type:
            continue
            
        conditions = rule.get("conditions", {})
        actions = rule.get("actions", {})
        
        # Evaluate conditions (ALL must match)
        match = True
        for key, expected_val in conditions.items():
            if bug.get(key) != expected_val:
                match = False
                break
                
        if not match:
            continue
            
        # Execute actions
        logger.info(f"[AUTOMATION] Rule '{rule.get('name')}' triggered on bug {bug_id}")
        
        updates = {}
        if "assignee_id" in actions:
            # We don't have a good way to mock assigning the name yet but in production
            # we would lookup the user and assign them properly
            assignee_id = actions["assignee_id"]
            user = db.get_user_by_id(assignee_id)
            if user:
                updates["assignee_id"] = assignee_id
                updates["assignee_name"] = user["name"]
                
        if "status" in actions:
            updates["status"] = actions["status"]
            
        if "priority" in actions:
            updates["priority"] = actions["priority"]
            
        if updates:
            try:
                # Update the bug in the DB
                # Note: We bypass strict permissions check here since it's the system updating it.
                db.update_bug(bug_id, updates)
                logger.info(f"[AUTOMATION] Applied updates: {updates}")
                
                # Also log an event for audit
                db.create_event(
                    event_type="bug.automated_update",
                    bug_id=bug_id,
                    payload_json={
                        "rule_name": rule.get("name"),
                        "updates": updates
                    }
                )
            except Exception as e:
                logger.error(f"[AUTOMATION] Failed to apply updates: {e}")
