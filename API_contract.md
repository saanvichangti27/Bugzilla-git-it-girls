\# API Contract v2 — Bugzilla Modernization Platform

Supersedes the earlier draft. Incorporates resolved decisions: \*\*Gemini API\*\* for AI, \*\*Render\*\* (backend) \+ \*\*Vercel\*\* (frontend) hosting, \*\*Supabase\*\* (DB \+ Auth), \*\*3-role auth\*\* (\`reporter / developer / admin\`).

\- \*\*Base URL (prod):\*\* \`https://\<your-app\>.onrender.com/api/v1\`  
\- \*\*Base URL (dev):\*\* \`http://localhost:8000/api/v1\`  
\- \*\*Format:\*\* JSON in / JSON out  
\- \*\*Auth:\*\* \`Authorization: Bearer \<jwt\>\` on every route except \`/auth/signup\`, \`/auth/login\`, and \`/webhooks/github\`.  
\- \*\*IDs:\*\* UUIDs (Supabase default)

\#\# Common envelope

\*\*Success:\*\* \`{ "data": { ... }, "error": null }\`  
\*\*Error:\*\* \`{ "data": null, "error": { "code": "BUG\_NOT\_FOUND", "message": "..." } }\`  
\*\*Status codes:\*\* \`200\` OK, \`201\` Created, \`400\` bad input, \`401\` no/invalid token, \`403\` forbidden, \`404\` not found, \`409\` conflict, \`422\` validation error, \`500\` server error.

\---

\#\# 1\. Auth & Roles

| Role | Permissions |  
|---|---|  
| \`reporter\` | Create bugs; view all bugs; comment on any bug; edit \*own\* bug's title/description while \`status \= new\` |  
| \`developer\` | All reporter permissions, plus: change status, priority, severity, component; assign/reassign bugs |  
| \`admin\` | All developer permissions, plus: change any user's role; delete bugs (optional) |

New signups always start as \`reporter\`. Role escalation is admin-only, never self-service. JWT carries \`role\` as a claim. \*Confirm exact Supabase custom-claims method name against current docs when implementing.\*

\#\#\# POST /auth/signup  
Request: \`{ "name": "Asha Rao", "email": "asha@example.com", "password": "min-8-chars" }\`  
Response \`201\`: \`{ "data": { "user": { "id", "name", "email", "role": "reporter" }, "token": "jwt" } }\`  
Errors: \`409 EMAIL\_EXISTS\`, \`422 VALIDATION\_ERROR\`

\#\#\# POST /auth/login  
Request: \`{ "email": "...", "password": "..." }\`  
Response \`200\`: same shape as signup.  
Errors: \`401 INVALID\_CREDENTIALS\`

\#\#\# GET /auth/me  
Response \`200\`: \`{ "data": { "id", "name", "email", "role", "created\_at" } }\`

\---

\#\# 2\. Users

\#\#\# GET /users  
Query: \`?search=asha\`  
Response \`200\`: \`{ "data": \[ { "id", "name", "email", "role" } \] }\`  
Used for assignee dropdowns (any authenticated user) and the admin role-management screen — frontend hides the role-edit control unless \`role \=== "admin"\`.

\#\#\# PATCH /users/:id/role  
\*\*Admin only.\*\*  
Request: \`{ "role": "developer" }\`  
Response \`200\`: \`{ "data": { "id", "name", "email", "role" } }\`  
Errors: \`403 FORBIDDEN\`, \`404 USER\_NOT\_FOUND\`, \`422 INVALID\_ROLE\`  
Side effect: \`events\` row \`user.role\_changed\` (optional, nice for the demo)

\---

\#\# 3\. Bugs

\#\#\# GET /bugs  
Query: \`status\`, \`priority\`, \`severity\`, \`component\`, \`assignee\_id\`, \`reporter\_id\`, \`page\`, \`page\_size\`, \`sort\`  
Response \`200\`:  
\`\`\`json  
{ "data": { "items": \[ { "id","title","status","priority","severity","component",  
  "assignee": {"id","name"}, "created\_at","updated\_at" } \], "page":1,"page\_size":20,"total":57 } }  
\`\`\`

\#\#\# POST /bugs  
\*\*Any role\*\* can create.  
Request:  
\`\`\`json  
{ "title":"...", "description":"...", "priority":"high", "severity":"major",  
  "component":"auth-ui", "assignee\_id":"uuid|null" }  
\`\`\`  
\`priority\`: \`low|medium|high|critical\` · \`severity\`: \`trivial|minor|major|critical|blocker\` · \`status\` server-set to \`new\`.  
Response \`201\`: full bug object. Side effect: \`events\` row \`bug.created\`.

\#\#\# GET /bugs/:id  
Response \`200\`:  
\`\`\`json  
{  
  "data": {  
    "id","title","description","status","priority","severity","component",  
    "assignee": {"id","name"} | null,  
    "reporter": {"id","name"},  
    "created\_at","updated\_at",  
    "github\_issue\_id": "string|null",  
    "github\_issue\_url": "string|null",  
    "ai\_summary": "string|null",  
    "ai\_summary\_generated\_at": "timestamp|null"  
  }  
}  
\`\`\`  
Errors: \`404 BUG\_NOT\_FOUND\`

\#\#\# PATCH /bugs/:id  
Permission rules:  
\- \`reporter\` — only \`title\`/\`description\`, only own bug, only while \`status \= new\`  
\- \`developer\`/\`admin\` — any field, any bug

Request (any subset): \`{ "status":"in\_progress", "priority":"critical", "assignee\_id":"uuid", "component":"..." }\`  
\`status\`: \`new|in\_progress|resolved|closed\`  
Response \`200\`: updated bug. Side effects: \`events\` row \`bug.status\_changed\` (if status changed, payload has \`from\`/\`to\`) and/or \`bug.updated\`.  
Errors: \`403 FORBIDDEN\`, \`404 BUG\_NOT\_FOUND\`, \`422 INVALID\_STATUS\_TRANSITION\` (optional)

\---

\#\# 4\. Comments

\#\#\# GET /bugs/:id/comments  
Response \`200\`: \`{ "data": \[ { "id","body","user":{"id","name"},"created\_at" } \] }\`

\#\#\# POST /bugs/:id/comments  
Any role. Request: \`{ "body": "..." }\`  
Response \`201\`: created comment. Side effect: \`events\` row \`comment.added\` (payload: \`bug\_id\`, \`comment\_id\`, \`body\`).

\---

\#\# 5\. Dashboard

\#\#\# GET /dashboard/summary  
Response \`200\`: \`{ "data": { "open\_bugs":34, "assigned\_to\_me":6, "resolved\_this\_week":11 } }\`

\---

\#\# 6\. Events (internal/debug visibility — good for showing judges the event log live)

\#\#\# GET /events  
Query: \`?event\_type=bug.created\&processed=false\&page=1\`  
Response \`200\`: \`{ "data": { "items":\[{"id","event\_type","bug\_id","payload\_json","created\_at","processed"}\], "page":1,"total":120 } }\`

Canonical event types: \`bug.created\`, \`bug.status\_changed\`, \`bug.updated\`, \`comment.added\`, \`user.role\_changed\`, \`github.issue\_created\`, \`github.pr\_merged\`, \`ai.summary\_generated\`.

\---

\#\# 7\. GitHub Integration

Hosted on Render — the deployed Render URL is the real webhook target from Day 1, no tunneling needed.

\#\#\# POST /webhooks/github  
Inbound receiver GitHub calls directly. Verifies \`X-Hub-Signature-256\` against the webhook secret. On \`pull\_request\` / \`action: closed\` / \`merged: true\` → parse bug ID from PR title/body (define a convention, e.g. \`Fixes \#BUG-<uuid>\`) → set bug status to \`resolved\` internally → \`events\` row \`github.pr\_merged\`.  
Response \`200\`: \`{ "data": { "received": true } }\` — return fast, do heavy work async.

\#\#\# Internal (triggered by dispatcher on \`bug.created\`, not a public endpoint)  
\`POST /repos/{owner}/{repo}/issues\` via Octokit/PyGithub → stores \`github\_issue\_id\`/\`github\_issue\_url\` on the bug → \`events\` row \`github.issue\_created\`.

\---

\#\# 8\. AI Summarization (Gemini)

\#\#\# POST /bugs/:id/summarize  
No body — server gathers description \+ comments, calls Gemini (\`google-genai\` SDK or REST) with a summarization prompt.  
Response \`200\`: \`{ "data": { "ai\_summary": "...", "generated\_at": "timestamp" } }\`  
Side effect: \`events\` row \`ai.summary\_generated\`; result cached on the bug row so repeat \`GET /bugs/:id\` doesn't re-call Gemini.  
Errors: \`502 AI\_PROVIDER\_ERROR\` — degrade gracefully in the UI, don't let a failed call break the bug detail page.

Recommend building this \*\*on-demand (button click)\*\* rather than auto-triggered on \`comment.added\` — more predictable for a live demo and avoids burning Gemini's free-tier rate limit (5–15 RPM) on comments nobody's looking at yet.

\---

\#\# 9\. Slack Notifications

Outbound-only from the dispatcher — no inbound endpoint needed. On \`bug.created\` with \`priority=critical\`, or \`bug.status\_changed\` to \`resolved\` → POST a formatted message to the Slack Incoming Webhook URL (stored as \`SLACK\_WEBHOOK\_URL\` env var).

Optional, if configurable from the UI:

\#\#\# GET /integrations/slack/rules  
\#\#\# PUT /integrations/slack/rules  
Request: \`{ "notify\_on": \["bug.created.critical", "bug.resolved"\] }\`

\---

\#\# 10\. Webhook Logs

\#\#\# GET /webhook-logs  
Query: \`?destination=slack|github\&success=true\&page=1\`  
Response \`200\`: \`{ "data": { "items":\[{"id","event\_type","destination","status\_code","success","created\_at"}\], "page":1,"total":40 } }\`

Every outbound GitHub/Slack call from the dispatcher writes a row here — both success and failure, so this doubles as your integration reliability evidence for the "Performance & Reliability" rubric line.

\---

\#\# 11\. Notifications

\#\#\# GET /notifications  
Query: \`?unread\_only=true\`  
Response \`200\`: \`{ "data": \[ { "id","type","message","bug\_id","read","created\_at" } \] }\`

\#\#\# PATCH /notifications/:id/read  
Response \`200\`: \`{ "data": { "id","read":true } }\`

\#\#\# PATCH /notifications/read-all  
Response \`200\`: \`{ "data": { "updated\_count":5 } }\`

If using Supabase real-time instead of polling, the frontend subscribes directly to \`notifications\` filtered by \`user\_id\` — keep these REST routes anyway as fallback/read-all convenience, they're cheap.

\---

\#\# 12\. Analytics

\#\#\# GET /analytics/overview  
Response \`200\`:  
\`\`\`json  
{  
  "data": {  
    "open\_bugs": 34, "critical\_bugs": 5, "avg\_resolution\_time\_hours": 26.4,  
    "bugs\_by\_component": \[ { "component":"auth-ui","count":12 } \],  
    "github\_prs\_linked": 9, "webhook\_success\_rate": 0.96  
  }  
}  
\`\`\`

\---

\#\# Environment variables this contract assumes exist

\`\`\`  
SUPABASE\_URL=  
SUPABASE\_SERVICE\_ROLE\_KEY=  
SUPABASE\_ANON\_KEY=  
GEMINI\_API\_KEY=  
GITHUB\_PAT=  
GITHUB\_WEBHOOK\_SECRET=  
SLACK\_WEBHOOK\_URL=  
\`\`\`

\#\# Deployment notes  
\- \*\*Backend → Render\*\*: set the above env vars in Render's dashboard; the deployed URL becomes both your API base URL and your GitHub webhook target.  
\- \*\*Frontend → Vercel\*\*: point \`VITE\_API\_BASE\_URL\` (or equivalent) at the Render backend URL.  
\- \*\*Database/Auth → Supabase\*\*: single project covers both; use the service-role key server-side only, never ship it to the frontend.
