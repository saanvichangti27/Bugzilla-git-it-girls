"""
Inbound GitHub webhook receiver — Phase 2.

Endpoint: POST /webhooks/github
No JWT auth (GitHub calls this directly).

Signature verification:
  GitHub sends: X-Hub-Signature-256: sha256=<hex_digest>
  We verify using HMAC-SHA256 over the raw request body with GITHUB_WEBHOOK_SECRET.
  Reference: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

PR-to-bug convention:
  PR title or body must contain:  Fixes #BUG-<uuid>
  Example:  Fixes #BUG-3203c4cd-a45b-469d-b20c-726d01333e0e
"""
import hashlib
import hmac
import logging
import re

from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.database import db
from app.events.events import log_event

logger = logging.getLogger("github_webhook")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Regex that captures the UUID after "Fixes #BUG-"
# Matches standard UUID format: 8-4-4-4-12 hex chars
_BUG_ID_RE = re.compile(
    r"Fixes\s+#BUG-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)

_OK_RESPONSE = JSONResponse(
    status_code=200,
    content={"data": {"received": True}, "error": None},
)


def _verify_signature(body: bytes, signature_header: str) -> bool:
    """
    Verify GitHub's X-Hub-Signature-256 header.

    GitHub format: "sha256=<hex_digest>"
    We compute HMAC-SHA256(secret, raw_body) and compare with constant-time compare.
    """
    secret = settings.GITHUB_WEBHOOK_SECRET
    if not secret:
        logger.warning("[WEBHOOK] GITHUB_WEBHOOK_SECRET is not set — rejecting all requests.")
        return False

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected_hex = signature_header[len("sha256="):]
    mac = hmac.new(secret.encode("utf-8"), msg=body, digestmod=hashlib.sha256)
    computed_hex = mac.hexdigest()

    # constant-time comparison to prevent timing attacks
    return hmac.compare_digest(computed_hex, expected_hex)


@router.post("/github")
async def github_webhook(
    request: Request,
    x_github_event: str = Header(None, alias="X-GitHub-Event"),
    x_hub_signature_256: str = Header(None, alias="X-Hub-Signature-256"),
):
    """
    Receive and process GitHub webhook events.

    Always returns 200 so GitHub doesn't retry on business-logic mismatches
    (missing bug ID in PR title, etc.). Only returns 401 on a bad signature.
    """
    body = await request.body()

    # ── 1. Verify HMAC signature ──────────────────────────────────────────────
    if not _verify_signature(body, x_hub_signature_256 or ""):
        logger.warning("[WEBHOOK] Invalid or missing X-Hub-Signature-256 — rejecting request.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_SIGNATURE", "message": "Webhook signature verification failed."},
        )

    # ── 2. Only handle pull_request events ───────────────────────────────────
    if x_github_event != "pull_request":
        logger.info(f"[WEBHOOK] Ignoring event type: {x_github_event!r}")
        return _OK_RESPONSE

    payload = await request.json() if not hasattr(request, "_json") else request._json
    # Re-parse from raw body (we already consumed it above)
    import json as _json
    try:
        payload = _json.loads(body)
    except Exception:
        logger.warning("[WEBHOOK] Could not parse JSON body.")
        return _OK_RESPONSE

    action = payload.get("action")
    pr = payload.get("pull_request", {})
    merged = pr.get("merged", False)

    # ── 3. Only act on merged PRs ─────────────────────────────────────────────
    if action != "closed" or not merged:
        logger.info(f"[WEBHOOK] PR event ignored: action={action!r}, merged={merged!r}")
        return _OK_RESPONSE

    pr_number = pr.get("number")
    pr_title = pr.get("title", "")
    pr_body = pr.get("body", "") or ""
    pr_url = pr.get("html_url", "")

    logger.info(f"[WEBHOOK] Merged PR #{pr_number}: {pr_title!r}")

    # ── 4. Extract bug ID from PR title or body ───────────────────────────────
    search_text = f"{pr_title}\n{pr_body}"
    match = _BUG_ID_RE.search(search_text)

    if not match:
        logger.info(
            f"[WEBHOOK] No bug ID found in PR #{pr_number} title/body. "
            "Use the convention: 'Fixes #BUG-<uuid>'"
        )
        return _OK_RESPONSE

    bug_id = match.group(1)
    logger.info(f"[WEBHOOK] Resolving bug {bug_id} from PR #{pr_number}.")

    # ── 5. Update bug status to resolved ─────────────────────────────────────
    raw_bug = db.get_bug(bug_id)
    if not raw_bug:
        logger.warning(f"[WEBHOOK] Bug {bug_id} not found in database.")
        return _OK_RESPONSE

    old_status = raw_bug.get("status")
    if old_status == "resolved":
        logger.info(f"[WEBHOOK] Bug {bug_id} is already resolved — no-op.")
        return _OK_RESPONSE

    db.update_bug(bug_id, {"status": "resolved"})

    # Log status change event (same as the PATCH path does)
    log_event(
        event_type="bug.status_changed",
        bug_id=bug_id,
        payload={
            "from": old_status,
            "to": "resolved",
            "updated_by": "github_webhook",
        },
    )

    # Log a dedicated GitHub PR merged event for the audit trail
    log_event(
        event_type="github.pr_merged",
        bug_id=bug_id,
        payload={
            "pr_number": pr_number,
            "pr_url": pr_url,
            "pr_title": pr_title,
        },
    )

    logger.info(f"[WEBHOOK] Bug {bug_id} resolved via PR #{pr_number}.")
    return _OK_RESPONSE
