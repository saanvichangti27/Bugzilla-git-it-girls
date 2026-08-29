# API Contract — Bugzilla Modernization Platform

Stack-agnostic REST/JSON contract. Works identically whether the backend is **Node.js + Express** or **Python + FastAPI** — see the "Node vs Python" note at the end.

- **Base URL (dev):** `http://localhost:8000/api/v1`
- **Format:** JSON in / JSON out (`Content-Type: application/json`)
- **Auth:** `Authorization: Bearer <jwt>` on every route except `/auth/signup`, `/auth/login`, and the GitHub webhook receiver.
- **IDs:** UUIDs (Supabase default) unless noted.

## Common envelope

**Success**
```json
{ "data": { ... }, "error": null }
```

**Error**
```json
{ "data": null, "error": { "code": "BUG_NOT_FOUND", "message": "Bug 123 does not exist" } }
```

**Standard status codes:** `200` OK, `201` Created, `400` bad input, `401` no/invalid token, `403` forbidden, `404` not found, `409` conflict, `422` validation error, `500` server error.

---

## 1. Auth & Roles

Three roles, Bugzilla-inspired but simplified for the timebox:

| Role | Permissions |
|---|---|
| `reporter` | Create bugs; view all bugs; comment on any bug; edit *own* bug's title/description pre-triage |
| `developer` | All reporter permissions, plus: change status, priority, severity, component; assign/reassign bugs |
| `admin` | All developer permissions, plus: change any user's role; delete bugs (optional) |

New signups always start as `reporter` — role escalation is an admin-only action, never self-service. The JWT carries the role as a claim (`role` field in the token payload) so middleware can authorize without a DB round-trip per request. *Confirm the exact Supabase custom-claims method name against current docs before implementing — this API surface changes between SDK versions.*

### POST /auth/signup
Request:
```json
{ "name": "Asha Rao", "email": "asha@example.com", "password": "min-8-chars" }
```
Response `201`:
```json
{ "data": { "user": { "id": "uuid", "name": "Asha Rao", "email": "asha@example.com", "role": "reporter" }, "token": "jwt" } }
```
Errors: `409 EMAIL_EXISTS`, `422 VALIDATION_ERROR`

### POST /auth/login
Request: `{ "email": "...", "password": "..." }`
Response `200`: same shape as signup (role included).
Errors: `401 INVALID_CREDENTIALS`

### GET /auth/me
Response `200`: `{ "data": { "id", "name", "email", "role", "created_at" } }`

---

## 2. Users

### GET /users
Query: `?search=asha` (optional)
Response `200`: `{ "data": [ { "id", "name", "email", "role" } ] }`
Note: used for assignee dropdowns (any authenticated user) as well as the admin role-management screen — the frontend can reuse this endpoint for both, just hide the role-edit control unless `auth.me.role === "admin"`.

### PATCH /users/:id/role
**Admin only.**
Request: `{ "role": "developer" }`
Response `200`: `{ "data": { "id", "name", "email", "role" } }`
Errors: `403 FORBIDDEN` (caller is not admin), `404 USER_NOT_FOUND`, `422 INVALID_ROLE`
**Side effect (optional but nice for the demo):** write an `events` row `user.role_changed`.

---

## 3. Bugs

### GET /bugs
Query params: `status`, `priority`, `severity`, `component`, `assignee_id`, `reporter_id`, `page` (default 1), `page_size` (default 20), `sort` (e.g. `-created_at`)

Response `200`:
```json
{
  "data": {
    "items": [ { "id", "title", "status", "priority", "severity", "component",
                 "assignee": {"id","name"}, "created_at", "updated_at" } ],
    "page": 1, "page_size": 20, "total": 57
  }
}
```

### POST /bugs
**Any authenticated role** (reporter, developer, admin) can create a bug.
Request:
```json
{
  "title": "Login button unresponsive on Safari",
  "description": "Steps to reproduce...",
  "priority": "high",        
  "severity": "major",       
  "component": "auth-ui",
  "assignee_id": "uuid | null"
}
```
`priority` enum: `low | medium | high | critical`
`severity` enum: `trivial | minor | major | critical | blocker`
`status` is server-set to `new` on create — not accepted from client.
Note: a `reporter` can set `assignee_id` on create too (that's normal triage flow), the restriction below is specifically about *reassigning after the fact*.

Response `201`: full bug object (see GET /bugs/:id).
**Side effect:** writes an `events` row of type `bug.created`.

### GET /bugs/:id
Response `200`:
```json
{
  "data": {
    "id", "title", "description", "status", "priority", "severity", "component",
    "assignee": {"id","name"} | null,
    "reporter": {"id","name"},
    "created_at", "updated_at",
    "github_issue_id": "string | null",
    "github_issue_url": "string | null",
    "ai_summary": "string | null",
    "ai_summary_generated_at": "timestamp | null"
  }
}
```
Errors: `404 BUG_NOT_FOUND`

### PATCH /bugs/:id
Permission rules:
- `reporter` — may only edit `title`/`description`, and only on a bug they reported, and only while `status = new`. Any other field or bug → `403`.
- `developer` / `admin` — may edit any field on any bug.

Request (any subset):
```json
{ "status": "in_progress", "priority": "critical", "assignee_id": "uuid", "component": "..." }
```
`status` enum: `new | in_progress | resolved | closed`
Response `200`: updated bug object.
**Side effect:** writes `events` row — `bug.status_changed` if `status` changed (payload includes `from`/`to`), plus `bug.updated` for any other field change.
Errors: `403 FORBIDDEN` (role/ownership check failed), `404 BUG_NOT_FOUND`, `422 INVALID_STATUS_TRANSITION` (if you choose to enforce a state machine — optional for MVP)

### DELETE /bugs/:id
Optional for MVP — not required by the brief. Skip unless you have spare time; not in judging scope.

---

## 4. Comments

### GET /bugs/:id/comments
Response `200`: `{ "data": [ { "id", "body", "user": {"id","name"}, "created_at" } ] }`

### POST /bugs/:id/comments
Request: `{ "body": "This also happens on Firefox 129." }`
Response `201`: created comment object.
**Side effect:** writes `events` row of type `comment.added` (payload: `bug_id`, `comment_id`, `body`).

---

## 5. Dashboard

### GET /dashboard/summary
Response `200`:
```json
{
  "data": {
    "open_bugs": 34,
    "assigned_to_me": 6,
    "resolved_this_week": 11
  }
}
```

---

## 6. Events (internal / debug visibility — not end-user facing, but useful for the demo & Phase 2 dispatcher)

### GET /events
Query: `?event_type=bug.created&processed=false&page=1`
Response `200`:
```json
{
  "data": {
    "items": [ { "id", "event_type", "bug_id", "payload_json", "created_at", "processed" } ],
    "page": 1, "total": 120
  }
}
```
Event types to standardize on: `bug.created`, `bug.status_changed`, `bug.updated`, `comment.added`, `github.issue_created`, `github.pr_merged`, `ai.summary_generated`.

This endpoint exists mainly so you can *show the judges* the event log live during the demo — pair it with a simple "Events" table in the UI.

---

## 7. GitHub Integration

### POST /integrations/github/link (optional, if you support connecting a repo per project rather than hardcoding one repo)
Request: `{ "owner": "yourorg", "repo": "yourrepo" }`
Response `200`: `{ "data": { "linked": true, "repo": "yourorg/yourrepo" } }`

### POST /webhooks/github
**This is the inbound receiver GitHub calls — not called by your frontend.**
Verifies `X-Hub-Signature-256` header against your webhook secret.
Handles event types via the `X-GitHub-Event` header, notably:
- `pull_request` with `action: "closed"` and `merged: true` → parse bug ID from PR body/title (e.g. `Fixes #BUG-123` convention you define) → `PATCH` the bug's status to `resolved` internally → write `events` row `github.pr_merged`.

Response `200`: `{ "data": { "received": true } }` (always return fast; do heavy work async if possible)

### Internal (not exposed to frontend, triggered by dispatcher on `bug.created`)
Calls GitHub REST API `POST /repos/{owner}/{repo}/issues` → stores `github_issue_id` / `github_issue_url` on the bug → writes `events` row `github.issue_created`.

---

## 8. AI Summarization

### POST /bugs/:id/summarize
No body required (server gathers description + comments internally).
Response `200`:
```json
{ "data": { "ai_summary": "Users on Safari 17 report...", "generated_at": "timestamp" } }
```
**Side effect:** writes `events` row `ai.summary_generated`; caches result on the bug row so repeat `GET /bugs/:id` calls don't re-call the LLM.
Errors: `502 AI_PROVIDER_ERROR` (LLM call failed — don't let this crash the bug page, degrade gracefully in the UI)

---

## 9. Slack Notifications

No public endpoints needed for MVP demo — this is outbound-only from the dispatcher (on `bug.created` with `priority=critical`, or `bug.status_changed` to `resolved`, POST to the Slack Incoming Webhook URL stored in an env var).

Optional, if you want it configurable from the UI:

### GET /integrations/slack/rules
### PUT /integrations/slack/rules
```json
{ "notify_on": ["bug.created.critical", "bug.resolved"] }
```

---

## 10. Webhook Logs

### GET /webhook-logs
Query: `?destination=slack|github&success=true&page=1`
Response `200`:
```json
{
  "data": {
    "items": [ { "id", "event_type", "destination", "status_code", "success", "created_at" } ],
    "page": 1, "total": 40
  }
}
```

---

## 11. Notifications

### GET /notifications
Query: `?unread_only=true`
Response `200`: `{ "data": [ { "id", "type", "message", "bug_id", "read", "created_at" } ] }`

### PATCH /notifications/:id/read
Response `200`: `{ "data": { "id", "read": true } }`

### PATCH /notifications/read-all
Response `200`: `{ "data": { "updated_count": 5 } }`

(If you go the Supabase real-time route instead of polling, the frontend subscribes directly to the `notifications` table filtered by `user_id`, and these REST routes become optional fallbacks — keep them anyway, they're trivial and useful for the "read all" action either way.)

---

## 12. Analytics

### GET /analytics/overview
Response `200`:
```json
{
  "data": {
    "open_bugs": 34,
    "critical_bugs": 5,
    "avg_resolution_time_hours": 26.4,
    "bugs_by_component": [ { "component": "auth-ui", "count": 12 } ],
    "github_prs_linked": 9,
    "webhook_success_rate": 0.96
  }
}
```

---

## Node vs Python note

This contract is transport-level (HTTP verbs, paths, JSON shapes) — it does not care whether the handlers behind it are written in Express or FastAPI. See the answer in chat for the full recommendation.
