import logging
import httpx
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.db.database import db
from app.config import settings

logger = logging.getLogger("automation")

def get_enabled_rules(event_type: str) -> List[dict]:
    """
    Get all enabled automation rules triggered by the specified event type.
    """
    rules = db.get_automation_rules()
    return [
        rule for rule in rules
        if rule.get("enabled", True) and rule.get("trigger_event_type") == event_type
    ]

def evaluate_conditions(conditions: List[dict], event_payload: dict) -> bool:
    """
    Evaluate if all conditions are met for a given event payload.
    Supports operators: '=', '!=', 'in', 'contains'.
    """
    if not conditions:
        return True

    for cond in conditions:
        field = cond.get("field")
        op = cond.get("operator")
        expected = cond.get("value")

        if not field or not op:
            continue

        actual = event_payload.get(field)

        # Handle operators
        if op == "=":
            if isinstance(actual, str) and isinstance(expected, str):
                match = actual.strip().lower() == expected.strip().lower()
            else:
                match = actual == expected
        elif op == "!=":
            if isinstance(actual, str) and isinstance(expected, str):
                match = actual.strip().lower() != expected.strip().lower()
            else:
                match = actual != expected
        elif op == "in":
            if isinstance(expected, list):
                if isinstance(actual, str):
                    match = any(str(item).strip().lower() == actual.strip().lower() for item in expected)
                else:
                    match = actual in expected
            elif isinstance(expected, str):
                # comma-separated values
                expected_list = [item.strip().lower() for item in expected.split(",") if item.strip()]
                if isinstance(actual, str):
                    match = actual.strip().lower() in expected_list
                else:
                    match = str(actual).strip().lower() in expected_list
            else:
                match = False
        elif op == "contains":
            if actual is None:
                match = False
            elif isinstance(actual, list):
                if isinstance(expected, str):
                    match = any(expected.lower() in str(item).lower() for item in actual)
                else:
                    match = expected in actual
            else:
                match = str(expected).lower() in str(actual).lower()
        else:
            match = False

        if not match:
            logger.debug(f"[AUTOMATION] Condition failed: {field} {op} {expected} (actual: {actual})")
            return False

    return True

async def execute_action(action: dict, event: dict, rule: dict) -> None:
    """
    Execute a specific action for a triggered rule and event.
    """
    action_type = action.get("type")
    if not action_type:
        logger.warning(f"[AUTOMATION] Action has no 'type': {action}")
        return

    bug_id = event.get("bug_id")
    event_type = event.get("event_type", "unknown")
    rule_id = rule.get("id", "unknown")
    rule_name = rule.get("name", "Unknown Rule")
    
    # Get bug title for notifications / logs
    bug_title = "Unknown Bug"
    bug = None
    if bug_id:
        bug = db.get_bug(bug_id)
        if bug:
            bug_title = bug.get("title", "Untitled Bug")

    # Support multiple key names for the action value to be flexible
    val = action.get("value")
    if val is None:
        val = action.get("url") or action.get("status") or action.get("priority") or action.get("user_id")

    logger.info(f"[AUTOMATION] Executing action {action_type} for rule '{rule_name}' on bug {bug_id}")

    try:
        if action_type == "notify_followers":
            if not bug:
                logger.warning(f"[AUTOMATION] notify_followers failed: bug {bug_id} not found")
                return
            followers = bug.get("followers") or []
            for uid in followers:
                title = f"Automation Alert: {bug_title}"
                body = f"Rule '{rule_name}' was triggered on event '{event_type}'."
                
                # Check in-app preference
                if db.is_notification_enabled(uid, event_type, "follower", "in_app"):
                    db.create_notification(
                        user_id=uid,
                        event_type=event_type,
                        relationship="follower",
                        title=title,
                        body=body,
                        bug_id=bug_id
                    )
                
                # Check email preference
                if db.is_notification_enabled(uid, event_type, "follower", "email"):
                    user_doc = db.get_user_by_id(uid)
                    if user_doc and user_doc.get("email"):
                        try:
                            from app.services.email_service import send_email
                            email_html = f"""
                                <h2 style='margin:0 0 8px;font-size:18px;'>{title}</h2>
                                <p style='color:#94a3b8;margin:0 0 16px;'>{body}</p>
                                <a href='{settings.APP_FRONTEND_URL}'
                                   style='background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;'>
                                  View Bug
                                </a>
                            """
                            send_email(
                                to=user_doc["email"],
                                subject=title,
                                html=email_html,
                                relationship="follower"
                            )
                        except Exception as exc:
                            logger.error(f"[AUTOMATION] Failed to send follower email to {user_doc['email']}: {exc!r}")

        elif action_type == "set_status":
            if not bug_id:
                return
            if bug and bug.get("status") != val:
                old_status = bug.get("status")
                db.update_bug(bug_id, {"status": val})
                from app.events.events import log_event
                log_event(
                    event_type="bug.status_changed",
                    bug_id=bug_id,
                    payload={
                        "title": bug_title,
                        "from": old_status,
                        "to": val,
                        "updated_by": "system-automation"
                    }
                )

        elif action_type == "set_priority":
            if not bug_id:
                return
            if bug and bug.get("priority") != val:
                db.update_bug(bug_id, {"priority": val})
                from app.events.events import log_event
                log_event(
                    event_type="bug.updated",
                    bug_id=bug_id,
                    payload={
                        "updated_fields": ["priority"],
                        "updated_by": "system-automation"
                    }
                )

        elif action_type == "assign_user":
            if not bug_id:
                return
            user_doc = db.get_user_by_id(val)
            assignee_name = user_doc.get("name", "Assigned User") if user_doc else "Assigned User"
            db.update_bug(bug_id, {
                "assignee_id": val,
                "assignee_name": assignee_name
            })
            from app.events.events import log_event
            log_event(
                event_type="bug.assigned",
                bug_id=bug_id,
                payload={
                    "assignee_id": val,
                    "assignee_name": assignee_name,
                    "updated_by": "system-automation"
                }
            )

        elif action_type == "send_webhook":
            if not val:
                logger.warning("[AUTOMATION] send_webhook URL is missing")
                return
                
            webhook_content = f"🤖 **Automation Rule Triggered:** `{rule_name}`\n**Event:** `{event_type}`\n**Bug:** {bug_title}\n**Status:** `{bug.get('status') if bug else 'N/A'}`\n**Priority:** `{bug.get('priority') if bug else 'N/A'}`"
            
            payload = {
                "event_type": event_type,
                "bug_id": bug_id,
                "rule_id": rule_id,
                "rule_name": rule_name,
                "content": webhook_content,  # For Discord
                "text": webhook_content,     # For Slack
                "event_payload": event.get("payload_json") or event.get("payload") or {},
                "bug": bug
            }
            
            status_code = None
            success = False
            
            try:
                async with httpx.AsyncClient() as client:
                    res = await client.post(val, json=payload, timeout=10.0)
                    status_code = res.status_code
                    success = res.is_success
            except Exception as exc:
                logger.error(f"[AUTOMATION] Webhook dispatch failed: {exc!r}")
                
            # Log the execution via create_webhook_log
            db.create_webhook_log(
                event_type=event_type,
                destination=f"automation_rule:{rule_id}",
                status_code=status_code,
                success=success
            )

        else:
            logger.warning(f"[AUTOMATION] Unknown action type '{action_type}'")

    except Exception as exc:
        logger.error(f"[AUTOMATION] Error executing action {action_type} for rule {rule_id}: {exc!r}")
