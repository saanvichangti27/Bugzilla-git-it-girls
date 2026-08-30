\# CloneFest 2.0 — Bugzilla Modernization: Final Plan (Backend Focus)

Frontend is intentionally out of scope for this doc — the API contract is the contract between frontend and backend, so frontend work can proceed in parallel without blocking or being blocked by anything below.

\---

\#\# 1\. Resolved decisions (was Section 8 open questions)

| Question | Resolution |  
|---|---|  
| AI provider | **Gemini API** (Google AI Studio) — free tier, no credit card, `google-genai` SDK |  
| Backend hosting | **Render** |  
| Frontend hosting | **Vercel** |  
| Database | **Supabase (Postgres)** |  
| Auth | **Supabase Auth**, extended with a custom `role` column — **multi-role**: `reporter / developer / admin / tester` |  
| Discord | Confirmed — team has workspace access, will create an Incoming Webhook |  
| GitHub webhook reachability | Solved by Render deployment — webhook points at the real Render URL from Day 1, no `ngrok` needed |

---

## 2. Tech stack (final)

| Layer | Choice |  
|---|---|  
| Database | Supabase Postgres |  
| Auth | Supabase Auth + `role` claim (`reporter | developer | admin | tester`) |  
| Backend framework | Node.js/Express **or** FastAPI — lock this in the Day 1 kickoff sync (contract below is language-agnostic either way) |  
| Event system | `events` table in Supabase, written via one shared `logEvent()` helper |  
| AI | Gemini API (`google-genai` SDK / REST) |  
| Source control | GitHub REST API + PAT (`repo` scope), Octokit or PyGithub |  
| Notifications | Discord Incoming Webhook |  
| Backend hosting | Render |  
| Frontend hosting | Vercel (not detailed here) |

---

## 3. Feature list (unchanged scope, confirmed stack)

**Phase 1 — Core (must work end-to-end before Phase 2 starts)**  
- Bug CRUD: title, description, status, priority, severity, component, assignee, timestamps  
- Comments (create + list, no edit/delete)  
- Auth: signup/login, 4-role model (added tester for QA workflow), role assigned by admin only  
- Dashboard aggregate counts (open bugs / assigned to me / resolved this week)  
- Event log: every create/status-change/comment writes an `events` row

**Phase 2 — Integration layer (the differentiator)**  
- GitHub: bug → issue on creation; PR merged → bug resolved (via webhook)  
- AI: on-demand bug summarization via Gemini  
- Discord: critical bug created / bug resolved → channel message  
- Webhook logs: table + listing of every outbound GitHub/Discord call  
- Notification center: per-user `notifications` table, polled or Supabase real-time  
- Analytics: aggregate endpoints for the dashboard charts

---

## 4. Why a 2-day, no-blocking split is possible

The dependency risk in a 3-person backend team is always the same: Person B can't build the dashboard until Person A's bug endpoints exist, Person C can't build the dispatcher until events are actually being written, etc. Two things remove that risk here:

1. **The schema and API contract are frozen before Day 1 starts** (see Section 5, the accompanying `api-contract-v2.md`). Nobody needs another person's *running code* — they need the agreed *shape* of the data, which already exists.  
2. **The only truly shared runtime dependency — writing to `events` — is reduced to one function signature**, published in the first 30 minutes and imported by everyone:  
   ```
   logEvent(eventType: string, bugId: string, payload: object): void
   ```  
   Person C builds the real implementation later; A and B can call a no-op stub with that exact signature from minute one and swap in the real import once it exists — no compile-time or runtime blocking either way.

**Kickoff (first 30–45 min, all three together):** lock backend language, freeze DB schema, freeze the API contract, agree on the `logEvent()` signature, create the Supabase project and share credentials. Everything after this point is parallel.

---

## 5. Task split — Day 1 (Foundations)

Each person owns a full vertical: schema fields for their domain + endpoints + tests, independently deployable and testable against Supabase directly.

| Person | Owns | Depends on others for | Notes |  
|---|---|---|---|  
| **A** | Bugs + Comments: full CRUD, filters, role-based permission rules (reporter/developer/admin) on bug mutation endpoints | Nothing — builds against frozen schema, calls `logEvent()` stub | Also writes the `github_issue_id`, `ai_summary` columns into the bugs schema now (empty/unused until Day 2) so nobody alters the table later |  
| **B** | Auth + Users + Roles: signup/login, Supabase Auth wiring, `PATCH /users/:id/role`, dashboard aggregate endpoint | Nothing — auth is self-contained; dashboard queries `bugs` table directly (read-only), doesn't need Person A's endpoints running, just the table existing | Seeds one admin account manually via SQL once role column exists |  
| **C** | Events: `events` table, real `logEvent()` implementation, event dispatcher skeleton (reads unprocessed events, routes by `event_type`, currently no-op handlers), `webhook_logs` table | Nothing — builds and unit-tests the dispatcher by inserting rows into `events` manually, doesn't need A or B's endpoints to be live | Publishes the `logEvent()` signature to A and B in the kickoff sync so they can wire it immediately |

**Day 1 exit check (quick sync, not a merge-and-pray):** each person demos their own slice independently — A shows bug CRUD via Postman/curl, B shows signup→login→role-change, C shows manually-inserted events flowing through the dispatcher to a console log. If all three pass independently, wiring them together on Day 2 is mechanical, not exploratory.

---

## 6. Task split — Day 2 (Integrations, Phase 2)

Each integration is still owned end-to-end by one person, plugging a handler into Person C's dispatcher via a shared `handlers/` folder — one file per person, so nobody edits someone else's file.

| Person | Owns | Depends on others for | Notes |  
|---|---|---|---|  
| **A** | GitHub integration (both directions): create issue on `bug.created`, receive/verify webhook, resolve bug on `pull_request.merged` | Dispatcher skeleton from Day 1 (already exists) | Registers `handleGithub(event)` in the dispatcher's handler map — a one-line addition, not a shared-file edit |  
| **B** | AI summarization (Gemini) + Notification center | Bugs/comments tables (already exist from Day 1, read-only) | Registers `handleAiTrigger(event)` if summarization is event-driven, or ships as an on-demand endpoint with zero dispatcher dependency at all — recommend the on-demand button for the demo, it's more reliable live than an automatic event trigger |  
| **C** | Discord notifications + Webhook logs finish-out + Analytics endpoints | Dispatcher (owns it already) | Registers `handleDiscord(event)`; also finalizes `webhook_logs` writes from A's and their own outbound calls |

**Priority order if Day 2 runs short:** GitHub → AI summarization → Discord → webhook logs → notification center → analytics. (Unchanged from the original plan — still the right order for the rubric.)

---

## 7. Environment variables checklist (agree in kickoff, so nobody blocks on missing secrets)

```
SUPABASE_URL=  
SUPABASE_SERVICE_ROLE_KEY=  
SUPABASE_ANON_KEY=  
GEMINI_API_KEY=  
GITHUB_PAT=  
GITHUB_WEBHOOK_SECRET=  
DISCORD_WEBHOOK_URL=
DISCORD_CREATED_WEBHOOK_URL=
DISCORD_RESOLVED_WEBHOOK_URL=
JWT_SECRET=            (only if not using Supabase Auth's own token issuance)
```

## 8. Demo-day reminders  
- Bootstrap one admin account manually via SQL right after Day 1 auth is live — don't build a UI for it.  
- Test the Gemini call and the GitHub webhook against the real Render URL by end of Day 2 morning, not the night before — both are the two pieces most likely to behave differently outside local dev.  
- README should explicitly state the scoped-down decisions (4-role model instead of full Bugzilla groups) as intentional, not missing — that's what protects the Problem Understanding marks.