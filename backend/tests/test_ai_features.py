"""
Tests for Gemini AI Features (Phase 3).
Covers:
  - POST /api/v1/bugs/suggest-fields (auto-suggestion & enum validation)
  - POST /api/v1/bugs/{id}/summarize (summarization & caching)
  - Duplicate detection in POST /api/v1/bugs
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import db

client = TestClient(app)

REPORTER_HEADERS = {"Authorization": "Bearer test-reporter-token"}


# ─── Feature 3: Auto-Suggest Fields ──────────────────────────────────────────

def test_suggest_fields_success():
    mock_ai_result = {
        "component": "backend",
        "priority": "high",
        "severity": "critical",
    }
    with patch("app.routers.bugs.suggest_bug_fields", return_value=mock_ai_result):
        res = client.post(
            "/api/v1/bugs/suggest-fields",
            json={
                "title": "Database connection timeout under heavy load",
                "description": "The backend fails to acquire connection from pool after 30s.",
            },
            headers=REPORTER_HEADERS,
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["component"] == "backend"
        assert data["priority"] == "high"
        assert data["severity"] == "critical"


def test_suggest_fields_ai_provider_error():
    with patch("app.routers.bugs.suggest_bug_fields", return_value=None):
        res = client.post(
            "/api/v1/bugs/suggest-fields",
            json={
                "title": "Syntax error in css",
                "description": "Button margin is misaligned.",
            },
            headers=REPORTER_HEADERS,
        )
        assert res.status_code == 502
        err = res.json()["error"]
        assert err["code"] == "AI_PROVIDER_ERROR"


# ─── Feature 1: Bug Summarization ─────────────────────────────────────────────

def test_summarize_bug_success():
    # 1. Create a test bug
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Summarize test bug",
            "description": "Detailed description of a complex memory leak in rendering service.",
            "priority": "medium",
            "severity": "major",
            "component": "frontend",
        },
        headers=REPORTER_HEADERS,
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]

    try:
        mock_summary = "The bug describes a memory leak during rendering. Discussion highlights canvas cleanup issues."
        with patch("app.routers.bugs.generate_bug_summary", return_value=mock_summary):
            res = client.post(
                f"/api/v1/bugs/{bug_id}/summarize",
                headers=REPORTER_HEADERS,
            )
            assert res.status_code == 200
            data = res.json()["data"]
            assert data["ai_summary"] == mock_summary
            assert "generated_at" in data

            # Verify summary is persisted in database
            updated_bug = db.get_bug(bug_id)
            assert updated_bug["ai_summary"] == mock_summary
            assert updated_bug["ai_summary_generated_at"] is not None

    finally:
        db.delete_bug(bug_id)


def test_summarize_bug_not_found():
    res = client.post(
        "/api/v1/bugs/00000000-0000-0000-0000-000000000000/summarize",
        headers=REPORTER_HEADERS,
    )
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "BUG_NOT_FOUND"


# ─── Feature 2: Duplicate Detection ──────────────────────────────────────────

def test_create_bug_with_duplicate_warning():
    # 1. Create an initial bug
    orig_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "OAuth login redirect loop on Safari",
            "description": "Users are continuously redirected to login page when using Safari 17.",
            "priority": "high",
            "severity": "major",
            "component": "frontend",
        },
        headers=REPORTER_HEADERS,
    )
    assert orig_res.status_code == 201
    orig_id = orig_res.json()["data"]["id"]

    try:
        # 2. Create duplicate bug with mock AI returning a match
        mock_dup = {
            "bug_id": orig_id,
            "reason": "Both reports describe an OAuth login loop specifically affecting Safari users.",
        }
        with patch("app.routers.bugs.detect_duplicate_bug", return_value=mock_dup):
            dup_res = client.post(
                "/api/v1/bugs",
                json={
                    "title": "Safari login loop after authentication",
                    "description": "Redirect stays in a loop when authenticating via Safari browser.",
                    "priority": "medium",
                    "severity": "minor",
                    "component": "frontend",
                },
                headers=REPORTER_HEADERS,
            )
            assert dup_res.status_code == 201
            data = dup_res.json()["data"]
            new_id = data["id"]
            db.delete_bug(new_id)

            assert data["possible_duplicate"] is not None
            assert data["possible_duplicate"]["bug_id"] == orig_id
            assert "OAuth login loop" in data["possible_duplicate"]["reason"]

    finally:
        db.delete_bug(orig_id)


def test_create_bug_when_ai_duplicate_fails_gracefully():
    # If detect_duplicate_bug fails/raises, bug creation must still succeed cleanly
    with patch("app.routers.bugs.detect_duplicate_bug", side_effect=RuntimeError("API limit exceeded")):
        res = client.post(
            "/api/v1/bugs",
            json={
                "title": "Normal bug submission without AI duplicate check",
                "description": "Testing graceful degradation when AI duplicate check fails.",
                "priority": "low",
                "severity": "trivial",
                "component": "others",
            },
            headers=REPORTER_HEADERS,
        )
        assert res.status_code == 201
        data = res.json()["data"]
        bug_id = data["id"]
        db.delete_bug(bug_id)
        assert data.get("possible_duplicate") is None
