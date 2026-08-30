"""
Email service using Resend (https://resend.com).
Free tier: 3,000 emails/month, no credit card required.

Setup:
  pip install resend
  Set RESEND_API_KEY in your .env

Older mock send_bugzilla_style_email kept for backward compatibility.
"""
import logging
from app.config import settings

logger = logging.getLogger("email_service")


def send_email(to: str, subject: str, html: str, relationship: str = "") -> bool:
    """Send a notification email via Resend.
    Returns True on success, False if skipped or failed.
    """
    if not settings.RESEND_API_KEY:
        logger.warning("[EMAIL] RESEND_API_KEY not set — skipping send (subject: %s)", subject)
        return False

    try:
        import resend  # type: ignore
        resend.api_key = settings.RESEND_API_KEY

        reason_map = {
            "reporter": "You are receiving this because you reported this bug.",
            "assignee": "You are receiving this because you are assigned to this bug.",
            "follower": "You are receiving this because you are following this bug.",
        }
        reason_text = reason_map.get(relationship, f"You are receiving this as a {relationship}.") if relationship else ""
        reason_line = f"""
            <p style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);
                       font-size:12px;color:#94a3b8;">
              {reason_text}
            </p>
        """ if reason_text else ""

        full_html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family:Inter,system-ui,sans-serif;background:#0f172a;
                     color:#f8fafc;padding:32px;max-width:600px;margin:0 auto;">
          <div style="background:#1e293b;border-radius:12px;padding:32px;
                      border:1px solid rgba(255,255,255,0.1);">
            <div style="margin-bottom:24px;">
              <span style="font-size:20px;font-weight:700;letter-spacing:-0.05em;">
                🐛 Bugzilla<span style="color:#6366f1;">.</span>
              </span>
            </div>
            {html}
            {reason_line}
          </div>
        </body>
        </html>
        """

        resend.Emails.send({
            "from": f"Bugzilla Modern <{settings.NOTIFY_FROM_EMAIL}>",
            "to": [to],
            "subject": subject,
            "html": full_html,
        })
        logger.info("[EMAIL] Sent '%s' to %s", subject, to)
        return True

    except ImportError:
        logger.warning("[EMAIL] 'resend' package not installed. Run: pip install resend")
        return False
    except Exception as exc:
        logger.error("[EMAIL] Failed to send to %s: %r", to, exc)
        return False


# ---------------------------------------------------------------------------
# Backward-compatible shim — kept so existing imports don't break
# ---------------------------------------------------------------------------
def send_bugzilla_style_email(user_id: str, subject: str, body: str) -> bool:
    """Legacy mock email that logs to console and creates in-app notification."""
    from app.db.database import db

    user = db.get_user_by_id(user_id)
    if not user:
        return False

    email = user.get("email")
    if not email:
        return False

    print(f"\n{'='*50}")
    print(f"📧 EMAIL DISPATCHED TO: {email}")
    print(f"SUBJECT: {subject}")
    print("-" * 50)
    print(body)
    print(f"{'='*50}\n")

    # If Resend is configured, actually send it
    send_email(email, subject, f"<pre>{body}</pre>")
    return True
