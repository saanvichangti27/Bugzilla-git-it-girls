import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import db
from app.services.automation import evaluate_conditions, get_enabled_rules
from app.services.dispatcher import process_event

client = TestClient(app)

ADMIN_HEADERS = {"Authorization": "Bearer test-admin-token"}

# --- Condition Evaluation Tests ---

def test_evaluate_conditions_equals():
    # String exact and case-insensitive
    conds = [{"field": "priority", "operator": "=", "value": "critical"}]
    assert evaluate_conditions(conds, {"priority": "critical"}) is True
    assert evaluate_conditions(conds, {"priority": "CRITICAL"}) is True
    assert evaluate_conditions(conds, {"priority": "high"}) is False

    # Numbers
    conds = [{"field": "count", "operator": "=", "value": 5}]
    assert evaluate_conditions(conds, {"count": 5}) is True
    assert evaluate_conditions(conds, {"count": 6}) is False

def test_evaluate_conditions_not_equals():
    conds = [{"field": "status", "operator": "!=", "value": "resolved"}]
    assert evaluate_conditions(conds, {"status": "new"}) is True
    assert evaluate_conditions(conds, {"status": "resolved"}) is False

def test_evaluate_conditions_in():
    # Array value
    conds = [{"field": "priority", "operator": "in", "value": ["critical", "high"]}]
    assert evaluate_conditions(conds, {"priority": "critical"}) is True
    assert evaluate_conditions(conds, {"priority": "normal"}) is False

    # Comma-separated string
    conds = [{"field": "priority", "operator": "in", "value": "critical, high"}]
    assert evaluate_conditions(conds, {"priority": "high"}) is True
    assert evaluate_conditions(conds, {"priority": "normal"}) is False

def test_evaluate_conditions_contains():
    # Substring
    conds = [{"field": "title", "operator": "contains", "value": "glitch"}]
    assert evaluate_conditions(conds, {"title": "Button UI glitch on safari"}) is True
    assert evaluate_conditions(conds, {"title": "Database is slow"}) is False

    # List contains
    conds = [{"field": "tags", "operator": "contains", "value": "security"}]
    assert evaluate_conditions(conds, {"tags": ["bug", "security"]}) is True
    assert evaluate_conditions(conds, {"tags": ["frontend"]}) is False


# --- Admin Endpoint & Storage Tests ---

def test_admin_automation_rules_lifecycle():
    # 1. Clear database rules
    db.automation_rules_db = {}
    
    # 2. Get rules (should be empty)
    res = client.get("/api/v1/admin/automation-rules", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    assert res.json()["data"] == []

    # 3. Create a rule (bulk PUT)
    new_rule = {
        "name": "Auto-escalate Critical Bugs",
        "trigger_event_type": "bug.created",
        "conditions": [{"field": "priority", "operator": "=", "value": "critical"}],
        "actions": [{"type": "set_status", "value": "in_progress"}],
        "enabled": True
    }
    
    res = client.put("/api/v1/admin/automation-rules", json=[new_rule], headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data) == 1
    assert data[0]["name"] == "Auto-escalate Critical Bugs"
    assert "id" in data[0]  # Verify UUID was auto-assigned
    rule_id = data[0]["id"]

    # Verify dict structure in DB
    assert rule_id in db.automation_rules_db
    assert db.automation_rules_db[rule_id]["name"] == "Auto-escalate Critical Bugs"

    # Clean up
    db.automation_rules_db = {}


# --- Dispatcher Integration Test ---

@pytest.mark.anyio
async def test_dispatcher_processes_automation_rules():
    # 1. Seed a bug and an automation rule
    bug_id = "test-bug-automation-id-123"
    db.bugs_db[bug_id] = {
        "id": bug_id,
        "title": "Severe Security Vulnerability",
        "description": "SQL Injection found",
        "status": "new",
        "priority": "critical",
        "severity": "critical",
        "component": "backend",
        "assignee_id": None,
        "assignee_name": None,
        "reporter_id": "user-reporter-id",
        "reporter_name": "Asha Rao",
        "created_at": "2026-08-30T12:00:00Z",
        "updated_at": "2026-08-30T12:00:00Z",
        "followers": []
    }

    rule_id = "test-rule-id"
    db.automation_rules_db[rule_id] = {
        "id": rule_id,
        "name": "Escalate critical bug on creation",
        "trigger_event_type": "bug.created",
        "conditions": [{"field": "priority", "operator": "=", "value": "critical"}],
        "actions": [{"type": "set_status", "value": "in_progress"}],
        "enabled": True
    }

    # 2. Simulate dispatching the bug.created event
    mock_event = {
        "id": "event-1234",
        "event_type": "bug.created",
        "bug_id": bug_id,
        "payload_json": {
            "title": "Severe Security Vulnerability",
            "priority": "critical"
        },
        "processed": False
    }

    await process_event(mock_event)

    # 3. Assert the action was executed (bug status changed to in_progress)
    updated_bug = db.get_bug(bug_id)
    assert updated_bug["status"] == "in_progress"

    # Clean up
    if bug_id in db.bugs_db:
        del db.bugs_db[bug_id]
    db.automation_rules_db = {}
