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
            reporter_id=raw_bug.get("reporter_id"),
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

async def handle_notifications(event: dict):
    """
    Priority 2d — dispatch in-app & email notifications to affected users.
    Resolves reporter, assignee, and followers from the bug then checks
    notification_preferences before creating a notification or sending email.
    """
    try:
        from app.services.email_service import send_email

        event_type = event.get("event_type", "")
        bug_id = event.get("bug_id")
        payload = event.get("payload_json") or event.get("payload") or {}

        if not bug_id or event_type not in (
            "bug.created", "bug.status_changed", "bug.resolved",
            "bug.comment_added", "bug.assigned",
        ):
            return

        raw_bug = db.get_bug(bug_id)
        if not raw_bug:
            return

        bug_title = raw_bug.get("title", "Untitled Bug")

        # --- Build title/body per event type ---
        if event_type == "bug.created":
            notif_title = f"Bug reported: {bug_title}"
            notif_body = "Your bug has been submitted and is now queued for review."
        elif event_type == "bug.status_changed":
            new_status = payload.get("to", raw_bug.get("status", "unknown")).replace("_", " ")
            notif_title = f"Status changed → {new_status}: {bug_title}"
            notif_body = f"The status of this bug was updated to '{new_status}'."
        elif event_type == "bug.resolved":
            notif_title = f"Bug resolved: {bug_title}"
            notif_body = "This bug has been marked as resolved."
        elif event_type == "bug.comment_added":
            commenter = payload.get("commenter_name", "Someone")
            notif_title = f"New comment on: {bug_title}"
            notif_body = f"{commenter} added a comment."
        elif event_type == "bug.assigned":
            notif_title = f"Bug assigned to you: {bug_title}"
            notif_body = "You have been assigned to this bug."
        else:
            return

        # --- Collect affected (user_id, relationship) pairs ---
        affected: list[tuple[str, str]] = []
        reporter_id = raw_bug.get("reporter_id")
        assignee_id = raw_bug.get("assignee_id")
        followers: list = raw_bug.get("followers") or []

        if reporter_id:
            affected.append((reporter_id, "reporter"))
        if assignee_id and assignee_id != reporter_id:
            affected.append((assignee_id, "assignee"))
        for uid in followers:
            if uid and uid != reporter_id and uid != assignee_id:
                affected.append((uid, "follower"))

        # --- Dispatch per user ---
        for user_id, relationship in affected:
            # In-app
            if db.is_notification_enabled(user_id, event_type, relationship, "in_app"):
                db.create_notification(
                    user_id=user_id,
                    event_type=event_type,
                    relationship=relationship,
                    title=notif_title,
                    body=notif_body,
                    bug_id=bug_id,
                )

            # Email
            if db.is_notification_enabled(user_id, event_type, relationship, "email"):
                user_doc = db.get_user_by_id(user_id)
                if user_doc and user_doc.get("email"):
                    email_html = f"""
                        <h2 style='margin:0 0 8px;font-size:18px;'>{notif_title}</h2>
                        <p style='color:#94a3b8;margin:0 0 16px;'>{notif_body}</p>
                        <a href='{getattr(__import__("app.config", fromlist=["settings"]), "settings", type("s", (), {"APP_FRONTEND_URL": "http://localhost:5173"})()).APP_FRONTEND_URL}'
                           style='background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;'>
                          View Bug
                        </a>
                    """
                    send_email(
                        to=user_doc["email"],
                        subject=notif_title,
                        html=email_html,
                        relationship=relationship,
                    )
            logger.debug(f"[NOTIFICATIONS] {event_type} → {user_id} ({relationship})")

    except Exception as exc:
        logger.error(f"[NOTIFICATIONS] Unhandled error for event {event.get('id')}: {exc!r}")

async def process_event(event: dict):
    event_type = event.get("event_type")
    
    # Route by event type
    try:
        if event_type == "bug.created":
            await handle_github(event)
            await handle_discord(event)
            await handle_notifications(event)
        elif event_type == "bug.status_changed":
            await handle_discord(event)
            await handle_notifications(event)
        elif event_type == "bug.resolved":
            await handle_notifications(event)
        elif event_type == "bug.comment_added":
            await handle_notifications(event)
        elif event_type == "bug.assigned":
            await handle_notifications(event)
        elif event_type == "github.pr_merged":
            pass # internally handled in github webhook usually, but dispatcher might have logic
        
        # --- Additive Automation Rules Layer ---
        try:
            from app.services.automation import get_enabled_rules, evaluate_conditions, execute_action
            enabled_rules = get_enabled_rules(event_type)
            if enabled_rules:
                # Merge bug fields if bug_id is present to allow rich condition matching
                bug_id = event.get("bug_id")
                bug_data = {}
                if bug_id:
                    bug_val = db.get_bug(bug_id)
                    if bug_val:
                        bug_data = bug_val
                
                event_payload = {**bug_data, **(event.get("payload_json") or event.get("payload") or {})}
                
                for rule in enabled_rules:
                    if evaluate_conditions(rule.get("conditions", []), event_payload):
                        for action in rule.get("actions", []):
                            await execute_action(action, event, rule)
        except Exception as auto_exc:
            logger.error(f"[AUTOMATION LAYER ERROR] Failed to process rules for event {event.get('id')}: {auto_exc!r}")

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
