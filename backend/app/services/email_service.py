from typing import Optional
from app.db.database import db

def send_bugzilla_style_email(user_id: str, subject: str, body: str) -> bool:
    """
    Mock email service to replicate Bugzilla's email notifications.
    In a real app, this would use SMTP or an API (e.g. Resend, SendGrid).
    For the hackathon, we'll log it to console and create an in-app notification.
    """
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
    
    # Also create an in-app notification so we can see it in the UI
    try:
        from app.routers.notifications import create_notification
        create_notification(user_id, f"{subject}\n{body}")
    except Exception as e:
        print(f"Failed to create in-app notification: {e}")
        
    return True
