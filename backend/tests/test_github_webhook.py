"""
Tests for GitHub webhook receiver (Phase 2).

These tests are fully self-contained and create+clean-up their own bugs.
They mock the GITHUB_WEBHOOK_SECRET on settings directly since the test
env may not have it set.
"""
import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.db.database import db

client = TestClient(app)

REPORTER_HEADERS = {"Authorization": "Bearer test-reporter-token"}

_TEST_SECRET = "webhook-test-secret-12345"


def _sign(body: bytes, secret: str = _TEST_SECRET) -> str:
    """Return the X-Hub-Signature-256 header value for a payload."""
    mac = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={mac}"


def _gh_headers(body: bytes, event: str = "pull_request") -> dict:
    return {
        "Content-Type": "application/json",
        "X-GitHub-Event": event,
        "X-Hub-Signature-256": _sign(body),
    }


@pytest.fixture(autouse=True)
def patch_webhook_secret(monkeypatch):
    """Inject a known secret into settings for every test in this file."""
    monkeypatch.setattr(settings, "GITHUB_WEBHOOK_SECRET", _TEST_SECRET)


# ─── Signature verification ───────────────────────────────────────────────────

def test_webhook_rejects_missing_signature():
    body = json.dumps({"action": "closed"}).encode()
    res = client.post(
        "/webhooks/github",
        content=body,
        headers={"Content-Type": "application/json", "X-GitHub-Event": "pull_request"},
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_SIGNATURE"


def test_webhook_rejects_bad_signature():
    body = json.dumps({"action": "closed"}).encode()
    res = client.post(
        "/webhooks/github",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": "sha256=deadbeefdeadbeef",
        },
    )
    assert res.status_code == 401


# ─── Non-PR events ───────────────────────────────────────────────────────────

def test_webhook_ignores_ping_event():
    body = json.dumps({"zen": "Keep it logically awesome."}).encode()
    res = client.post(
        "/webhooks/github",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-GitHub-Event": "ping",
            "X-Hub-Signature-256": _sign(body),
        },
    )
    assert res.status_code == 200
    assert res.json()["data"]["received"] is True


# ─── Merged PR with matching bug ─────────────────────────────────────────────

def test_webhook_resolves_bug_on_merged_pr():
    # 1. Create a bug to resolve
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Webhook resolve test bug",
            "description": "This bug will be resolved via PR webhook",
            "priority": "medium",
            "severity": "minor",
            "component": "backend",
        },
        headers=REPORTER_HEADERS,
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]

    try:
        # 2. Send a "PR merged" webhook with the convention: Fixes #BUG-<uuid>
        pr_payload = {
            "action": "closed",
            "pull_request": {
                "number": 42,
                "title": f"Fix authentication bug — Fixes #BUG-{bug_id}",
                "body": "Resolves the login failure reported in staging.",
                "html_url": "https://github.com/test/repo/pull/42",
                "merged": True,
            },
        }
        body = json.dumps(pr_payload).encode()
        res = client.post("/webhooks/github", content=body, headers=_gh_headers(body))

        assert res.status_code == 200
        assert res.json()["data"]["received"] is True

        # 3. Verify the bug status was updated in the database
        updated = db.get_bug(bug_id)
        assert updated is not None
        assert updated["status"] == "resolved", f"Expected 'resolved', got '{updated['status']}'"

    finally:
        db.delete_bug(bug_id)


# ─── Merged PR without a bug ID — should not error ───────────────────────────

def test_webhook_no_bug_id_returns_200():
    pr_payload = {
        "action": "closed",
        "pull_request": {
            "number": 99,
            "title": "Refactor login page layout",
            "body": "No bug linked in this PR.",
            "html_url": "https://github.com/test/repo/pull/99",
            "merged": True,
        },
    }
    body = json.dumps(pr_payload).encode()
    res = client.post("/webhooks/github", content=body, headers=_gh_headers(body))
    assert res.status_code == 200
    assert res.json()["data"]["received"] is True


# ─── Closed but not merged PR — should not resolve bug ────────────────────────

def test_webhook_closed_not_merged_ignores():
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Webhook not-merged test bug",
            "description": "Should stay open",
            "priority": "low",
            "severity": "trivial",
            "component": "frontend",
        },
        headers=REPORTER_HEADERS,
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]

    try:
        pr_payload = {
            "action": "closed",
            "pull_request": {
                "number": 10,
                "title": f"Fixes #BUG-{bug_id}",
                "body": "",
                "html_url": "https://github.com/test/repo/pull/10",
                "merged": False,  # <-- not merged
            },
        }
        body = json.dumps(pr_payload).encode()
        res = client.post("/webhooks/github", content=body, headers=_gh_headers(body))
        assert res.status_code == 200

        # Bug should still be in its original 'new' status
        still_open = db.get_bug(bug_id)
        assert still_open["status"] == "new"

    finally:
        db.delete_bug(bug_id)
