import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import db

client = TestClient(app)

REPORTER_HEADERS = {"Authorization": "Bearer test-reporter-token"}
TESTER_HEADERS = {"Authorization": "Bearer test-tester-token"}
DEVELOPER_HEADERS = {"Authorization": "Bearer test-developer-token"}
ADMIN_HEADERS = {"Authorization": "Bearer test-admin-token"}

def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "running"

def test_missing_auth_header():
    res = client.get("/api/v1/bugs")
    assert res.status_code == 401
    body = res.json()
    assert body["data"] is None
    assert body["error"]["code"] == "MISSING_TOKEN"

def test_create_bug():
    payload = {
        "title": "Dropdown glitch on Chrome",
        "description": "Clicking dropdown closes immediately",
        "priority": "high",
        "severity": "major",
        "component": "ui-components",
        "assignee_id": None
    }
    res = client.post("/api/v1/bugs", json=payload, headers=REPORTER_HEADERS)
    assert res.status_code == 201
    body = res.json()
    assert body["error"] is None
    data = body["data"]
    bug_id = data["id"]
    try:
        assert data["title"] == "Dropdown glitch on Chrome"
        assert data["status"] == "new"
        assert data["reporter"]["id"] == "11111111-1111-1111-1111-111111111102"
    finally:
        db.delete_bug(bug_id)

def test_get_bugs_list():
    res = client.get("/api/v1/bugs?priority=high", headers=DEVELOPER_HEADERS)
    assert res.status_code == 200
    body = res.json()
    assert body["error"] is None
    data = body["data"]
    assert "items" in data
    assert data["page"] == 1

def test_get_bug_detail():
    res = client.get("/api/v1/bugs/11111111-1111-1111-1111-111111111111", headers=REPORTER_HEADERS)
    assert res.status_code in (200, 404)

def test_get_bug_not_found():
    res = client.get("/api/v1/bugs/99999999-9999-9999-9999-999999999999", headers=REPORTER_HEADERS)
    assert res.status_code == 404
    body = res.json()
    assert body["data"] is None
    assert body["error"]["code"] == "BUG_NOT_FOUND"

def test_reporter_permission_rules_success():
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Initial Title",
            "description": "Initial Desc",
            "priority": "low",
            "severity": "trivial",
            "component": "core"
        },
        headers=REPORTER_HEADERS
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]
    try:
        patch_res = client.patch(
            f"/api/v1/bugs/{bug_id}",
            json={"title": "Updated Title By Reporter", "description": "Updated Desc"},
            headers=REPORTER_HEADERS
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["data"]["title"] == "Updated Title By Reporter"
    finally:
        db.delete_bug(bug_id)

def test_reporter_permission_rules_disallowed_fields():
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Disallow test",
            "description": "Desc",
            "priority": "low",
            "severity": "trivial",
            "component": "core"
        },
        headers=REPORTER_HEADERS
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]
    try:
        patch_res = client.patch(
            f"/api/v1/bugs/{bug_id}",
            json={"priority": "critical"},
            headers=REPORTER_HEADERS
        )
        assert patch_res.status_code == 403
        body = patch_res.json()
        assert body["data"] is None
        assert body["error"]["code"] == "FORBIDDEN"
    finally:
        db.delete_bug(bug_id)

def test_developer_patch_any_field():
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Dev patch test",
            "description": "Desc",
            "priority": "low",
            "severity": "trivial",
            "component": "backend"
        },
        headers=REPORTER_HEADERS
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]
    try:
        patch_res = client.patch(
            f"/api/v1/bugs/{bug_id}",
            json={"status": "in_progress", "priority": "critical", "component": "backend"},
            headers=DEVELOPER_HEADERS
        )
        assert patch_res.status_code == 200
        data = patch_res.json()["data"]
        assert data["status"] == "in_progress"
        assert data["priority"] == "critical"
        assert data["component"] == "backend"
    finally:
        db.delete_bug(bug_id)

def test_developer_resolve_and_tester_verify():
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Auth modal crash",
            "description": "Modal crashes on submit",
            "priority": "high",
            "severity": "major",
            "component": "auth-ui"
        },
        headers=REPORTER_HEADERS
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]
    try:
        dev_patch = client.patch(
            f"/api/v1/bugs/{bug_id}",
            json={"status": "ready_for_testing"},
            headers=DEVELOPER_HEADERS
        )
        assert dev_patch.status_code == 200
        assert dev_patch.json()["data"]["status"] == "ready_for_testing"

        tester_list = client.get("/api/v1/bugs?status=ready_for_testing", headers=TESTER_HEADERS)
        assert tester_list.status_code == 200
        ready_ids = [b["id"] for b in tester_list.json()["data"]["items"]]
        assert bug_id in ready_ids

        tester_patch = client.patch(
            f"/api/v1/bugs/{bug_id}",
            json={"status": "resolved"},
            headers=TESTER_HEADERS
        )
        assert tester_patch.status_code == 200
        assert tester_patch.json()["data"]["status"] == "resolved"

        get_res = client.get(f"/api/v1/bugs/{bug_id}", headers=TESTER_HEADERS)
        assert get_res.status_code == 200
        assert get_res.json()["data"]["status"] == "resolved"
    finally:
        db.delete_bug(bug_id)

def test_tester_send_back_to_in_progress():
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Bug to send back",
            "description": "Tester will reject this fix",
            "priority": "medium",
            "severity": "minor",
            "component": "frontend"
        },
        headers=REPORTER_HEADERS
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]
    try:
        dev_patch = client.patch(
            f"/api/v1/bugs/{bug_id}",
            json={"status": "ready_for_testing"},
            headers=DEVELOPER_HEADERS
        )
        assert dev_patch.status_code == 200

        tester_patch = client.patch(
            f"/api/v1/bugs/{bug_id}",
            json={"status": "in_progress"},
            headers=TESTER_HEADERS
        )
        assert tester_patch.status_code == 200
        assert tester_patch.json()["data"]["status"] == "in_progress"

        get_res = client.get(f"/api/v1/bugs/{bug_id}", headers=TESTER_HEADERS)
        assert get_res.status_code == 200
        assert get_res.json()["data"]["status"] == "in_progress"
    finally:
        db.delete_bug(bug_id)

def test_comments_flow():
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Comment test bug",
            "description": "Bug for comment testing",
            "priority": "low",
            "severity": "trivial",
            "component": "backend"
        },
        headers=REPORTER_HEADERS
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]
    try:
        post_res = client.post(
            f"/api/v1/bugs/{bug_id}/comments",
            json={"body": "Investigated logs, reproducing in staging environment."},
            headers=DEVELOPER_HEADERS
        )
        assert post_res.status_code == 201
        assert post_res.json()["data"]["body"] == "Investigated logs, reproducing in staging environment."

        post_res2 = client.post(
            f"/api/v1/bugs/{bug_id}/comments",
            json={"body": "Fix is in progress."},
            headers=DEVELOPER_HEADERS
        )
        assert post_res2.status_code == 201

        get_res = client.get(f"/api/v1/bugs/{bug_id}/comments", headers=REPORTER_HEADERS)
        assert get_res.status_code == 200
        comments = get_res.json()["data"]
        assert len(comments) >= 2
    finally:
        db.delete_bug(bug_id)

def test_similar_bugs_search():
    res = client.get("/api/v1/bugs/similar?q=login", headers=REPORTER_HEADERS)
    assert res.status_code == 200
    data = res.json()["data"]
    assert isinstance(data, list)

def test_follow_unfollow_bug():
    create_res = client.post(
        "/api/v1/bugs",
        json={
            "title": "Follow test bug",
            "description": "Bug for testing follow functionality",
            "priority": "low",
            "severity": "minor",
            "component": "frontend"
        },
        headers=REPORTER_HEADERS
    )
    assert create_res.status_code == 201
    bug_id = create_res.json()["data"]["id"]
    try:
        # Follow bug
        follow_res = client.post(f"/api/v1/bugs/{bug_id}/follow", headers=DEVELOPER_HEADERS)
        assert follow_res.status_code == 200
        assert follow_res.json()["data"]["is_following"] is True
        assert follow_res.json()["data"]["followers_count"] >= 1

        # Unfollow bug
        unfollow_res = client.post(f"/api/v1/bugs/{bug_id}/unfollow", headers=DEVELOPER_HEADERS)
        assert unfollow_res.status_code == 200
        assert unfollow_res.json()["data"]["is_following"] is False
    finally:
        db.delete_bug(bug_id)

def test_file_upload_attachment():
    files = {"file": ("test_image.png", b"fake image bytes content", "image/png")}
    res = client.post("/api/v1/bugs/upload", files=files, headers=REPORTER_HEADERS)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["file_name"] == "test_image.png"
    assert data["file_url"].startswith("/uploads/")

