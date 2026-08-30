# CloneFest 2.0 — Bugzilla Modernization Project Plan

## 1. Project Overview

**Event:** CloneFest 2.0 — Developer Tool Reconstruction track
**Assigned tool:** Bugzilla (https://github.com/bugzilla/bugzilla)
**Team size:** 3
**Duration:** 3 days

Bugzilla is a mature, open-source, web-based bug/issue tracking system. The goal of this project is **not** to rebuild Bugzilla from scratch and **not** to strip it down to "just a pretty UI." The goal is to **modernize Bugzilla's experience while keeping its core issue-tracking power**, with the key innovation being an **event-driven integration layer** connecting bug tracking to GitHub, Slack, and AI.

> **Vision:** A centralized, event-driven issue management platform that connects bug tracking, development, communication, and AI into one workflow.

**Confirmed:** You are building a **new, lightweight application inspired by Bugzilla's data model and workflows** — not modifying Bugzilla's actual legacy Perl codebase. This is the right call for a 3-day/3-person team.

---

## 2. What You Are Supposed to Do

1. Build a working bug-tracking application that preserves Bugzilla's core concepts (bugs, status, priority, severity, components, comments, assignees).
2. Layer a **modern, simplified UI** on top of it.
3. Add an **event system** so every meaningful action (bug created, status changed, comment added) emits an event.
4. On top of the event system, build **integrations** (GitHub, Slack, AI) that react to those events — this is your main differentiator for the "Innovation" and "Technical Implementation" judging categories.
5. Document everything clearly, since **Documentation & Explanation is 10/100 marks** and a working demo backed by clear docs scores far better than an undocumented one.

The project is split into two build phases:

- **Phase 1 (MVP):** Core bug tracking + minimal modern UI + event system.
- **Phase 2 (Add-ons):** GitHub integration, AI bug summarization, Slack notifications, webhook logs, notification center, analytics dashboard.

---

## 3. Judging Rubric Reference

| # | Criterion | Marks | Primarily addressed by |
|---|---|---|---|
| 1 | Problem Understanding & Core Functionality | 20 | Phase 1 |
| 2 | Innovation & Meaningful Differentiation | 20 | Phase 2 (event system + integrations) |
| 3 | Technical Implementation & Architecture | 15 | Phase 1 + Phase 2 |
| 4 | User Experience & Accessibility | 15 | Phase 1 UI, Phase 2 dashboard/notification center |
| 5 | Performance & Reliability / Demo Quality | 20 | Both — but only matters if the demo actually works end-to-end |
| 6 | Documentation & Explanation | 10 | Ongoing — write as you build, not on Day 3 night |

**Implication:** A fully working Phase 1 + one polished Phase 2 feature will likely score higher than a half-broken Phase 1 + five rushed Phase 2 features. Don't start Phase 2 until Phase 1 works end-to-end and is demoable.

---

## 4. Phase 1 — MVP (Core Bug Tracking + Minimal UI + Event System)

### 4.1 Features in Detail

**A. Bug tracking core**
- Create, view, edit, list bugs
- Fields: title, description, status (New / In Progress / Resolved / Closed), priority, severity, component, assignee, created/updated timestamps
- Comments on a bug (simple threaded list, no editing/deleting needed for MVP)
- Bug list view with basic filters (status, assignee, priority)

**B. Authentication**
- Basic login/signup (email + password, or a simplified single-role system)
- No need for Bugzilla's granular group/permission system in Phase 1 — flag as future work

**C. Minimal modern UI**
- Dashboard: count of open bugs, bugs assigned to me, bugs resolved this week
- Simple bug creation form (title, description, priority, component, assignee — skip "basic/advanced mode" split for now)
- Bug detail page showing fields + comments
- Bug list page with filters

**D. Event system**
- Every meaningful action (bug created, status changed, comment added) writes an event record
- Kept intentionally simple: a database table acting as an event log/queue, **not** Kafka/RabbitMQ/Redis
- This event log is what Phase 2 integrations will read from — so the schema matters, see below

### 4.2 Tech Stack (assumption — confirm with your team before Day 1)

| Layer | Suggested choice | Notes |
|---|---|---|
| Frontend | React (Vite) + Tailwind CSS | Fast to scaffold, widely known |
| Backend | Node.js + Express | Keeps frontend/backend in one language (JS/TS) for a 3-person team |
| Database | **Supabase (hosted PostgreSQL)** | No DB hosting/ops needed, generous free tier, real relational DB with joins — good fit for bugs/comments/users/events schema |
| Auth | **Supabase Auth** (built-in) | Saves you from hand-rolling JWT/password-hashing logic in Phase 1; if your team prefers full control, a custom JWT + `bcrypt` setup on the Supabase Postgres DB also works — pick one on Day 1 and don't switch |
| Event system | An `events` table in the same Supabase DB, written to on every action | No external queue (Redis/Kafka) needed at this scale — Redis is an in-memory key-value store, not suited to be the primary relational DB for this schema, so it's left out unless you later need caching/pub-sub |

This stack is a reasonable default, not the only option — if your team is stronger in Python, FastAPI + PostgreSQL works equally well. Pick one and don't switch mid-hackathon.

### 4.3 Suggested Data Model (starting point)

```
users(id, name, email, password_hash, created_at)
bugs(id, title, description, status, priority, severity, component, assignee_id, reporter_id, created_at, updated_at)
comments(id, bug_id, user_id, body, created_at)
events(id, event_type, bug_id, payload_json, created_at, processed boolean)
```

### 4.4 Implementation Steps

1. Set up repo structure (frontend/backend), CI-free for now — keep it simple.
2. Define DB schema and run migrations (bugs, users, comments, events tables).
3. Build backend CRUD endpoints for bugs and comments.
4. Add auth endpoints (signup/login) and middleware.
5. On every bug create/update/comment endpoint, insert a row into `events`.
6. Build frontend: login, dashboard, bug list, bug create form, bug detail page.
7. Wire frontend to backend APIs.
8. Manually test the full loop: create bug → see it on dashboard → change status → see event logged in DB.
9. Freeze Phase 1 once this loop works — don't keep polishing, move to Phase 2.

---

## 5. Phase 2 — Integrations & Intelligence Layer

All Phase 2 features consume the `events` table from Phase 1. Build a small **event dispatcher** (a function/service that reads new/unprocessed events and routes them to the right handler) once, then plug each integration into it.

### 5.1 GitHub Integration
**What it does:** Two-way link between bugs and GitHub.
- Bug created in your app → auto-creates a GitHub issue (via GitHub REST API)
- Developer opens a PR referencing the bug → PR merged → GitHub sends a webhook → your app marks the bug as Resolved
**Tech:** GitHub REST API, Octokit (Node) or `PyGithub` (Python), GitHub Webhooks (requires a public URL — use `ngrok` or similar for local dev during the hackathon).
*Verify exact Octokit/PyGithub method names against current documentation before relying on them in code — don't assume API syntax.*
**Steps:**
1. Create a GitHub App or Personal Access Token with `repo` scope (PAT is faster for a hackathon).
2. On `bug.created` event → call GitHub API to create an issue, store the `github_issue_id` against the bug.
3. Set up a webhook endpoint in your backend to receive GitHub events (PR merged, issue closed).
4. On receiving `pull_request.merged` referencing a bug ID → update bug status to Resolved.

### 5.2 AI Bug Summarization
**What it does:** Summarizes a bug's comments/history into a short paragraph, shown on the bug detail page.
**Tech:** An LLM API (e.g., Anthropic Claude API or OpenAI API — **decide which one you have access/keys for**, see Open Questions).
*Do not assume specific SDK method names — verify against the current API docs when writing the integration code.*
**Steps:**
1. On demand (button click) or on `comment.added` event, gather bug description + comments.
2. Send to the LLM API with a summarization prompt.
3. Store/display the summary on the bug detail page.

### 5.3 Discord Notifications
**What it does:** Posts messages to a Discord channel for chosen events (e.g., critical bug created, bug resolved).
**Tech:** Discord Webhooks (simplest — no OAuth app needed for a hackathon).
**Steps:**
1. Create a Discord Webhook URL for a test channel (Server Settings > Integrations > Webhooks).
2. On `bug.created` (if priority = critical) or `bug.resolved` event → POST a formatted message (JSON with `content` or `embeds`) to the webhook URL.
3. (Optional) Let users toggle which events notify — even a hardcoded rule is fine for demo purposes.

### 5.4 Webhook Logs
**What it does:** A UI table showing each outgoing webhook call (GitHub/Discord), its status, and retries — makes the integration layer feel like a real platform.
**Tech:** A `webhook_logs` table (event_type, destination, status_code, timestamp, success boolean); simple frontend table/page.
**Steps:**
1. Every time you call GitHub/Slack from the dispatcher, log the attempt and response.
2. Build a simple "Webhook History" page listing these logs, newest first.

### 5.5 Notification Center
**What it does:** An in-app bell icon showing recent notifications (critical bug assigned to me, PR merged, AI duplicate detected, etc.)
**Tech:** A `notifications` table per user. Simple polling (fetch every N seconds) is enough — but since you're on Supabase, its built-in real-time subscriptions can push new notifications to the frontend without polling, if time allows. *Verify the exact Supabase real-time API/method names against current docs before relying on them in code.*
**Steps:**
1. On relevant events, insert a row into `notifications` for the affected user.
2. Frontend bell icon either polls for unread notifications or subscribes to real-time updates, and displays them in a dropdown.

### 5.6 Analytics Dashboard
**What it does:** Shows aggregate stats — open bugs, critical bugs, average resolution time, bugs by component, plus integration metrics (GitHub PRs linked, webhook success rate).
**Tech:** Simple aggregate SQL queries + a charting library (e.g., Recharts for React).
**Steps:**
1. Write backend endpoints that aggregate counts/averages from the `bugs` and `webhook_logs` tables.
2. Build a dashboard page with a few charts/cards.

---

## 6. Task Split — Phase 1 (3 People)

| Day | Person A | Person B | Person C |
|---|---|---|---|
| Day 1 | DB schema + bug CRUD APIs | Auth (signup/login) + UI shell/routing | Events table + event-writing logic on all actions |
| Day 2 | Bug detail page + comments (frontend + API) | Dashboard UI + bug list/filter UI | Bug create form (frontend + API) |
| Day 3 (AM) | Integration testing of full CRUD loop | UI polish, responsive fixes | End-to-end test: create → update → event logged |

**Phase 1 exit criteria (all 3 must agree before moving to Phase 2):** login works, bug CRUD works, comments work, dashboard shows real data, every action writes a row to `events`.

## 7. Task Split — Phase 2 (3 People)

Assuming roughly a remaining ~1.5–2 days after Phase 1 is frozen:

| Feature | Owner | Notes |
|---|---|---|
| Event dispatcher (shared foundation) | Person C (built events table in Phase 1) | Must be done first — everything else depends on it |
| GitHub integration (both directions) | Person A | Highest effort, highest payoff — prioritize |
| AI bug summarization | Person B | High "wow" factor for relatively low effort |
| Discord notifications | Person C (after dispatcher) | Low effort once dispatcher exists |
| Webhook logs UI | Person A (after GitHub) or Person C | Cheap add-on, do only if time remains |
| Notification center | Person B (after AI summary) | Do only if time remains |
| Analytics dashboard | Whoever finishes first | Lowest priority — nice polish, not core to the pitch |

**Priority order if time runs out:** GitHub integration → AI summarization → Discord → webhook logs → notification center → analytics dashboard.

---

## 8. Open Questions / Doubts to Resolve

These need a decision from your team (and possibly event organizers) before or during the build — flagging rather than assuming:

1. **AI provider access:** Do you have an API key/credits for Anthropic Claude, OpenAI, or another LLM provider for the hackathon? This determines which SDK you build against.
2. **GitHub webhook reachability:** Local dev servers aren't publicly reachable — you'll need `ngrok` (or similar) or to deploy the backend somewhere public during the hackathon for GitHub webhooks to work. Decide this early, not on Day 3.
3. **Auth complexity:** Is a single-role login sufficient for the demo, or does the judging expect Bugzilla-style groups/permissions? Confirm this doesn't cost you marks under "Problem Understanding." (Using Supabase Auth makes adding roles later easier if needed.)
4. **Frontend/backend hosting:** Supabase covers the database (and optionally auth), but you still need to decide where the frontend and backend API are hosted for the live demo (e.g., Vercel for frontend, Render/Railway for backend) — this also affects the GitHub webhook reachability question above.
5. **Discord server access:** Do you have a Discord server you're allowed to create a Webhook in for the demo?
6. **Time buffer:** This plan assumes Phase 1 finishes by end of Day 1 evening. If it slips into Day 2, you should cut Phase 2 scope (drop notification center + analytics dashboard first) rather than compress GitHub/AI integration quality.

---

*Note: Library/API method names mentioned above (Octokit, PyGithub, jsonwebtoken, Recharts, Discord Webhooks, Anthropic/OpenAI SDKs) are real tools, but exact syntax may change — verify against current official docs when writing the actual code rather than relying on memory.*