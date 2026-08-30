import httpx
from typing import Optional, Dict, Any, Tuple
from app.config import settings
from app.db.database import db

GITHUB_API_BASE = "https://api.github.com"

def get_github_credentials(user_id: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (github_token, github_repo) for a user, 
    falling back to global settings if user hasn't configured them.
    """
    user_doc = db.get_user_by_id(user_id)
    if user_doc and user_doc.get("github_token") and user_doc.get("github_repo"):
        return user_doc["github_token"], user_doc["github_repo"]
    
    return settings.GITHUB_TOKEN, settings.GITHUB_REPO

def create_github_issue(bug_data: Dict[str, Any], user_id: str) -> Optional[Dict[str, Any]]:
    """
    Creates an issue on GitHub in the configured repository.
    Returns a dict with 'id' (str/int) and 'html_url' (str), or None if it fails.
    """
    token, repo = get_github_credentials(user_id)
    if not token or not repo:
        return None

    url = f"{GITHUB_API_BASE}/repos/{repo}/issues"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Bugzilla-Git-It-Girls"
    }
    
    body = f"**Reporter**: {bug_data.get('reporter_name')}\n" \
           f"**Severity**: {bug_data.get('severity')}\n" \
           f"**Component**: {bug_data.get('component')}\n\n" \
           f"{bug_data.get('description')}\n\n" \
           f"---\n" \
           f"*Linked from Bugzilla-Git-It-Girls ID: {bug_data.get('id')}*"

    payload = {
        "title": f"[{bug_data.get('component')}] {bug_data.get('title')}",
        "body": body,
        "labels": ["bug"]
    }

    try:
        with httpx.Client() as client:
            response = client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code == 201:
                data = response.json()
                return {
                    "id": str(data["number"]),
                    "html_url": data["html_url"]
                }
            else:
                print(f"[GITHUB SERVICE ERROR] Failed to create issue: {response.text}")
    except Exception as e:
        print(f"[GITHUB SERVICE ERROR] Exception during create_github_issue: {e}")
        
    return None

def setup_repository_webhook(token: str, repo: str, app_webhook_url: str) -> bool:
    """
    Configures a GitHub webhook on the target repository to listen for PR events.
    """
    url = f"{GITHUB_API_BASE}/repos/{repo}/hooks"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Bugzilla-Git-It-Girls"
    }

    try:
        with httpx.Client() as client:
            res = client.get(url, headers=headers)
            if res.status_code == 200:
                hooks = res.json()
                for hook in hooks:
                    if hook.get("config", {}).get("url") == app_webhook_url:
                        return True # Already exists

            payload = {
                "name": "web",
                "active": True,
                "events": ["pull_request"],
                "config": {
                    "url": app_webhook_url,
                    "content_type": "json",
                    "insecure_ssl": "0"
                }
            }
            res = client.post(url, headers=headers, json=payload)
            return res.status_code == 201
    except Exception as e:
        print(f"[GITHUB SERVICE ERROR] setup_repository_webhook failed: {e}")
        return False
