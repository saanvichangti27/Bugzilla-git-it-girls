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
    assert data["title"] == "Dropdown glitch on Chrome"
    assert data["status"] == "new"
    assert data["reporter"]["id"] == "user-reporter-id"

def test_get_bugs_list():
    res = client.get("/api/v1/bugs?priority=high", headers=DEVELOPER_HEADERS)
    assert res.status_code == 200
    body = res.json()
    assert body["error"] is None
    data = body["data"]
    assert "items" in data
    assert data["page"] == 1
    assert data["total"] >= 1

def test_get_bug_detail():
    res = client.get("/api/v1/bugs/11111111-1111-1111-1111-111111111111", headers=REPORTER_HEADERS)
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["id"] == "11111111-1111-1111-1111-111111111111"

def test_get_bug_not_found():
    res = client.get("/api/v1/bugs/99999999-9999-9999-9999-999999999999", headers=REPORTER_HEADERS)
    assert res.status_code == 404
    body = res.json()
    assert body["data"] is None
    assert body["error"]["code"] == "BUG_NOT_FOUND"

def test_reporter_permission_rules_success():
    # 1. Create a bug as reporter
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
    bug_id = create_res.json()["data"]["id"]

    # 2. Reporter edits title/description on own bug while status=new -> SUCCESS
    patch_res = client.patch(
        f"/api/v1/bugs/{bug_id}",
        json={"title": "Updated Title By Reporter", "description": "Updated Desc"},
        headers=REPORTER_HEADERS
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["title"] == "Updated Title By Reporter"

def test_reporter_permission_rules_disallowed_fields():
    # Reporter attempting to edit status or priority -> 403 FORBIDDEN
    patch_res = client.patch(
        "/api/v1/bugs/11111111-1111-1111-1111-111111111111",
        json={"priority": "critical"},
        headers=REPORTER_HEADERS
    )
    assert patch_res.status_code == 403
    body = patch_res.json()
    assert body["data"] is None
    assert body["error"]["code"] == "FORBIDDEN"

def test_developer_patch_any_field():
    patch_res = client.patch(
        "/api/v1/bugs/11111111-1111-1111-1111-111111111111",
        json={"status": "in_progress", "priority": "critical", "component": "backend"},
        headers=DEVELOPER_HEADERS
    )
    assert patch_res.status_code == 200
    data = patch_res.json()["data"]
    assert data["status"] == "in_progress"
    assert data["priority"] == "critical"
    assert data["component"] == "backend"

def test_comments_flow():
    bug_id = "11111111-1111-1111-1111-111111111111"
    
    # 1. Post comment
    post_res = client.post(
        f"/api/v1/bugs/{bug_id}/comments",
        json={"body": "Investigated logs, reproducing in staging environment."},
        headers=DEVELOPER_HEADERS
    )
    assert post_res.status_code == 201
    assert post_res.json()["data"]["body"] == "Investigated logs, reproducing in staging environment."

    # 2. Get comments
    get_res = client.get(f"/api/v1/bugs/{bug_id}/comments", headers=REPORTER_HEADERS)
    assert get_res.status_code == 200
    comments = get_res.json()["data"]
    assert len(comments) >= 2
