# Bugzilla Modernization — Prioritized Implementation Plan

*Built from the current repo state + `new_implemenattion_plan.md`. Ordered so each step is safe to ship before the next starts. Effort estimates carried from the source plan; file paths verified against the actual repo.*

---

## How to read this

Each phase has: **why it's this priority**, **exact tasks with file paths**, **effort**, and **acceptance criteria** (how you know it's done). Do them top to bottom — later phases assume earlier ones are merged.

---

## Priority 0 — Stabilize (do this today, ~3–5 hours, blocking everything else)

Your repo currently cannot build cleanly and has three sources of duplicate/conflicting side effects. Nothing else matters until these are fixed — a judge or teammate pulling `main` right now gets a broken Vite build.

### 0.1 — Fix the shipped merge conflict (30 min)
**File:** `frontend/src/pages/Dashboard.jsx`
Confirmed: literal `<<<<<<< HEAD` / `=======` / `>>>>>>> raksha` markers are sitting in `renderCreateForm()` and in the bug-title/attachment rendering block. This is a hard JS syntax error — `npm run build` and `npm run dev` both fail right now.

**Decision to make:** two versions of `renderCreateForm` are fighting — an inline form (HEAD) vs. `<AddBugModal isOpen={showCreateForm} .../>` (raksha branch). **Keep the `AddBugModal` version** — it already has the two-step AI-assisted flow (similar-bug search → structured report → attachments), which is strictly more built-out than the inline form.
Also resolve the second conflict block in the bug row (attachments + duplicate-warning rendering) — keep the `raksha` version, it has attachment pill rendering that HEAD's block doesn't.

**Action:**
1. Open the file, delete both conflict marker blocks, keeping the `AddBugModal`-based `renderCreateForm` and the attachment-aware bug-row block.
2. Run `npm run build` in `frontend/` and confirm it exits 0.

### 0.2 — Pick one inbound GitHub webhook route (1 hr)
**Files:** `backend/app/routers/webhooks.py` (delete the GitHub piece) vs. `backend/app/routers/github_webhook.py` (keep)
Both are mounted simultaneously in `backend/app/main.py` (`app.include_router(webhooks.router, ...)` and `app.include_router(github_webhook.router)`), on the **same URL path** `/webhooks/github` (one under `/api/v1`, one without prefix — still a collision risk and definitely duplicated logic). `github_webhook.py` has HMAC signature verification (`X-Hub-Signature-256`) and a tested `Fixes #BUG-<uuid>` convention; `webhooks.py` has no verification and a different `Fixes #<issue-number>` convention that doesn't match your actual bug IDs (UUIDs).

**Action:**
1. In `backend/app/main.py`, remove `from app.routers import ... webhooks ...` and delete the `app.include_router(webhooks.router, prefix=settings.API_PREFIX)` line.
2. Delete `backend/app/routers/webhooks.py` (or gut it to just re-export nothing if something else imports it — check `db.bugs_db` usage first, nothing external depends on it per the grep of routers).
3. Standardize on `Fixes #BUG-<uuid>` everywhere: PR template (add one at `.github/pull_request_template.md` if you don't have one), README, `API_contract.md` §7.
4. Confirm `backend/tests/test_github_webhook.py` still passes — it already targets `github_webhook.py`'s behavior.

### 0.3 — Pick one outbound GitHub issue-creation path (1 hr)
**Files:** `backend/app/services/github.py::create_github_issue()` (called synchronously inside `backend/app/routers/bugs.py::create_bug()`) vs. `backend/app/services/github_service.py::create_github_issue()` (called by `backend/app/services/dispatcher.py::handle_github()` on the `bug.created` event)
Confirmed: `create_bug()` calls `create_github_issue(raw_bug, current_user.id)` directly and updates the bug row, **and** separately calls `log_event("bug.created", ...)`, which the dispatcher picks up and calls `handle_github()`, which calls the *other* `create_github_issue()` and updates the bug row *again*. Every new bug currently creates **two GitHub issues**.

**Action:**
1. In `backend/app/routers/bugs.py::create_bug()`, delete the synchronous block:
   ```python
   github_issue = create_github_issue(raw_bug, current_user.id)
   if github_issue: ...
   ```
   and its import (`from app.services.github import create_github_issue`).
2. Keep the dispatcher-driven path (`app/services/dispatcher.py::handle_github` → `app/services/github_service.py`) since it's async/non-blocking and already writes a `github.issue_created` event for the audit trail.
3. Decide the fate of `app/services/github.py` — it's also used by `get_github_credentials()` / per-user token support in `app/routers/users.py::update_github_settings()`. Keep the file for that, just remove its `create_github_issue()` call site from `bugs.py`. (Longer-term: `github_service.py` should also respect per-user tokens, currently it only reads global `GITHUB_PAT`/`GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` — flag as a follow-up, not blocking.)

### 0.4 — Reconcile docs with code (30 min)
**Files:** `project_desc.md`, `API_contract.md`, `clone-fest-plan.md`
Docs say 3 roles (`reporter/developer/admin`) + Slack; code has 4 roles (`+ tester`, see `ROLE_TEST_IDS` in `backend/app/auth/dependencies.py`) + Discord (`DISCORD_WEBHOOK_URL`/`DISCORD_CREATED_WEBHOOK_URL`/`DISCORD_RESOLVED_WEBHOOK_URL` in `config.py`, used in `dispatcher.py::handle_discord`).

**Action:** Update the role table and notification-channel references in both docs to match reality. Frame it explicitly as an intentional scope decision (tester role added for QA workflow, Discord chosen over Slack for team access) — this protects your Documentation Understanding marks rather than looking like drift.

### 0.5 — Move uploads off local disk (2–3 hr)
**File:** `backend/app/routers/bugs.py::upload_attachment()`
Confirmed: writes via `shutil.copyfileobj` to `backend/uploads/`, which is local disk. Render's filesystem is ephemeral — every redeploy wipes it, silently breaking every existing attachment link stored in `bugs.attachments`.

**Action:**
1. Create a Supabase Storage bucket named `attachments` (public read).
2. In `upload_attachment()`, replace the local-disk write with `db.client.storage.from_("attachments").upload(...)`, then use the returned public URL as `file_url`.
3. No frontend changes needed — `AddBugModal.jsx`, `BugList.jsx`, `Dashboard.jsx`, `TesterDashboard.jsx` all already branch on `att.file_url.startsWith('http')` to decide whether to prefix `API_BASE`.
4. Keep a local-disk fallback path only for the in-memory/no-Supabase dev mode (`db.use_supabase == False`), same pattern the rest of `database.py` already uses.

### 0.6 *(optional, cheap insurance)* — Build guard (1 hr)
Add a CI step (or a pre-push git hook) that runs `npm run build` in `frontend/` and `pytest` in `backend/`. This is what would have caught 0.1 before it was committed.

**Phase 0 acceptance criteria:**
- `npm run build` succeeds cleanly in `frontend/`.
- Only one GitHub inbound webhook route registered in `main.py`.
- Only one GitHub issue is created per new bug (verify by creating a test bug and checking your repo for exactly one issue).
- A test attachment upload survives a manual Render redeploy.
- `project_desc.md` / `API_contract.md` role and notification-channel sections match the running code.

---

## Priority 1 — Design system starter kit (~1 day, do immediately after Phase 0)

**Why here, not at the end:** every remaining phase below ships new UI (admin permission grids, notification bell + preferences page, automation rule builder, analytics charts). If you build those against ad-hoc inline styles now, you re-style all of them a second time when you eventually get to full Phase 5 polish. Building the token file + three core components first means everything after this point lands on the design system once.

### 1.1 — Design tokens (2–3 hr)
**File:** `frontend/src/index.css`
Expand the existing `:root` block (which today only has single-value colors like `--primary`, `--danger` and three radii):
- Color: 5–9 step scale per hue (default/hover/active/disabled/border) so nobody writes another inline `rgba(6,182,212,0.05)` (this literal currently appears verbatim in `TesterDashboard.jsx` and elsewhere).
- Spacing: `--space-1` through `--space-6` (4/8/12/16/24/32px).
- Typography: `--text-xs` through `--text-2xl` with matched line-heights.
- Elevation: 2–3 shadow levels (card / dropdown / modal) — today there's one `--shadow-glass` used everywhere.
- Keep dark-only for now (matches Linear/Supabase/Vercel convention for dev tools); don't build a light theme.
- Write `DESIGN_SYSTEM.md` documenting each token and when to use it.

### 1.2 — Three core components (4–5 hr)
**New directory:** `frontend/src/components/ui/`
Build just these three now (the rest come in the full Phase 5 pass later):
- `<Button>` — variants primary/outline/ghost/danger, loading-spinner state, icon slot. Replaces the dozens of hand-styled `<button style={{...}}>` instances across `Dashboard.jsx`, `TesterDashboard.jsx`, `AddBugModal.jsx`, `Auth.jsx`.
- `<Badge>` — single color-mapping function keyed off status/priority/severity, replacing the `badge-${bug.status}` className string pattern repeated in `BugList.jsx`, `Dashboard.jsx`, `TesterDashboard.jsx`, `AdminDashboard.jsx`.
- `<Table>` — the single biggest near-term win: `BugList.jsx`, `Dashboard.jsx`'s `renderDeveloperBugList`, and `TesterDashboard.jsx` all currently hand-roll near-identical `<table>` markup (~200+ duplicated lines total). One component with role-driven column/action props collapses all three.

**Acceptance criteria:** `<Button>`/`<Badge>`/`<Table>` exist in `frontend/src/components/ui/`; at least the highest-traffic usage (`BugList.jsx`) is migrated to prove the pattern; `DESIGN_SYSTEM.md` exists and documents every token.

---

## Priority 2 — Search upgrade + in-app & email notifications (~1.5–2 days)

**Why this priority:** `API_contract.md` §11 and `clone-fest-plan.md` both already promise `GET /notifications`, `PATCH /notifications/:id/read`, and a `notifications` table. **None of it exists in the code** — no table in `backend/app/db/database.py`, no router, no bell icon in `Layout.jsx`, no email-sending capability anywhere (no `email_service.py`, no SMTP/API config in `config.py`). This is the single largest gap between what your docs promise and what's shipped, and it's the feature explicitly requested.

### 2a. Search upgrade (0.5 day)
**File:** `backend/app/db/database.py::search_similar_bugs()`
Currently a plain in-memory/`ilike` substring match with no ranking (see the `if q_lower in title or q_lower in desc` fallback).

```sql
alter table bugs add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index bugs_search_idx on bugs using gin(search_vector);
```
Update the Supabase branch of `search_similar_bugs()` to use `.text_search()` against `search_vector`, ranked by `ts_rank`. Keep the in-memory fallback's current behavior unchanged (same external contract). No frontend change needed — `GET /bugs/similar` keeps its shape, so `AddBugModal.jsx` Step 1 is unaffected.

### 2b. Notification schema (0.5 day)
Add to `backend/app/db/database.py` (new Supabase tables + in-memory fallback dicts, following the existing pattern for `events_db`/`webhook_logs_db`):
```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  relationship text not null,      -- 'reporter' | 'assignee' | 'follower'
  title text not null,
  body text,
  bug_id uuid references bugs(id),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on notifications(user_id, read);

create table notification_preferences (
  user_id uuid not null,
  event_type text not null,
  relationship text not null,
  channel text not null,           -- 'in_app' | 'email'
  enabled boolean not null default true,
  primary key (user_id, event_type, relationship, channel)
);
```
Seed defaults on user creation (in `backend/app/routers/auth.py::signup()`): `in_app = true` for everything; `email = true` only for `assigned_to_you` and `mentioned`-type events, to avoid inbox spam.

### 2c. Email service (0.25 day)
**New file:** `backend/app/services/email_service.py`
Use **Resend** (permanent free tier, 3,000 emails/month, no card). Add `RESEND_API_KEY` to `backend/app/config.py` and `.env.example`.
```python
import resend
from app.config import settings
import logging

logger = logging.getLogger("email_service")
resend.api_key = settings.RESEND_API_KEY

def send_email(to: str, subject: str, html: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning("[EMAIL] RESEND_API_KEY not set, skipping send.")
        return False
    try:
        resend.Emails.send({
            "from": "Bugzilla Modernized <notifications@yourdomain.com>",
            "to": [to],
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as exc:
        logger.error(f"[EMAIL] send failed: {exc!r}")
        return False
```
Every template includes a Bugzilla-style reason line ("You are receiving this because you are the assignee of this bug"), using the stored `relationship` value — copy this specific behavior verbatim, it's a trust feature.

### 2d. Wire into the dispatcher (0.25 day)
**File:** `backend/app/services/dispatcher.py`
Add `handle_notifications(event)`, called from `process_event()` alongside the existing `handle_github`/`handle_discord`:
1. Resolve affected users + relationship from the bug's `reporter_id`, `assignee_id`, `followers` (the `followers` list already exists on every bug via `follow_bug()`/`unfollow_bug()` in `database.py`).
2. Look up `notification_preferences` per `(event_type, relationship)`.
3. `in_app` enabled → insert into `notifications`.
4. `email` enabled → call `send_email()`.
5. Log outcome via `db.create_webhook_log()` (`destination="email"`) — this is already built but currently has no callers (confirmed: `db.create_webhook_log()` exists in `database.py`, nothing calls it), so this closes that gap too.

### 2e. API endpoints
**New file:** `backend/app/routers/notifications.py`, mounted in `main.py` like the other Person A/C routers:
- `GET /notifications?unread_only=true`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`
- `GET/PUT /notifications/preferences` — the matrix endpoint, with bulk "Enable All Mail"/"Disable All Mail" actions.

### 2f. Frontend (0.5 day)
- Bell icon + dropdown in `frontend/src/components/Layout.jsx` (poll every 20–30s to start).
- New `frontend/src/pages/NotificationPreferences.jsx`: rows = event type, columns = In-app/Email checkboxes, plus Enable All/Disable All buttons. Build this against the `<Button>`/`<Badge>` components from Priority 1, not raw styles.
- Unread-count badge on the bell using `<Badge>`.

### 2g. *(optional)* Dispatcher latency
**File:** `backend/app/services/dispatcher.py::dispatcher_loop()`
Currently a 1-second poll (`await asyncio.sleep(1)`). Swap for a Supabase Realtime subscription on `INSERT` to the `events` table if time allows — not blocking for the demo.

**Acceptance criteria:** Reporter creates a bug → assigned developer gets an in-app row + email with correct reason line; status changes to `resolved` → followers get in-app notifications, opted-in ones get email; turning off "Email" for one (event, relationship) pair stops future emails for just that combination.

---

## Priority 3 — Automation rules layer (~1.5–2 days)

**Why this priority:** highest marginal Innovation-rubric payoff, and it reuses infrastructure you already built (the `events` table + `dispatcher.py`) instead of requiring new plumbing.

**New table:**
```sql
create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_event_type text not null,
  conditions jsonb not null default '[]',
  actions jsonb not null default '[]',
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
```
**New file:** `backend/app/services/automation.py`
- `evaluate_conditions(conditions, event_payload) -> bool` — support only `=`, `!=`, `in`, `contains` (not full JQL — sized for this project).
- `execute_action(action, event)` dispatch table: `notify_followers`, `set_status`, `set_priority`, `assign_user`, `send_webhook` (arbitrary URL — covers ad-hoc Discord/Slack/anything without new code per destination).
- Wire into `backend/app/services/dispatcher.py::process_event()`, added *after* the existing hardcoded handlers: `for rule in get_enabled_rules(event_type): if evaluate_conditions(...): [execute_action(...) for a in rule.actions]`. Purely additive — can't break existing behavior.
- Log every execution via `db.create_webhook_log()` (`destination="automation_rule:<rule_id>"`).

**Frontend:** `frontend/src/pages/AutomationRules.jsx` — list with on/off toggles; a small trigger → condition rows → action rows builder form (admin-only, gate behind `role === 'admin'` like `AdminDashboard.jsx` already does in `App.jsx`'s routing).

**Acceptance criteria:** create a rule "when `bug.created` and `priority = critical` → `notify_followers` + `send_webhook` to a Discord URL"; create a critical bug; confirm it fires with zero code changes.

---

## Priority 4 — Analytics & AI-flow unification (~1 day)

**Why this priority:** cheap relative to earlier phases, and highly visible in a demo — plus it depends on the `webhook_logs` data that Priorities 2–3 just started populating, so it's genuinely more meaningful now than if built earlier.

**New endpoint:** `GET /analytics/overview` in a new `backend/app/routers/analytics.py` (implements `API_contract.md` §12):
- `open_bugs`: count where `status in (new, in_progress, ready_for_testing)`
- `critical_bugs`: count where `priority = 'critical'` and not resolved/closed
- `avg_resolution_time_hours`: derive from `events` rows where `event_type = 'bug.status_changed'` and `payload_json->>'to' = 'resolved'`, minus the bug's `created_at` — **not** `bugs.updated_at - created_at`, since `updated_at` is overwritten by any later edit (e.g. reopen-then-reresolve) and would silently corrupt this metric.
- `bugs_by_component`: group by component, count
- `github_prs_linked`: count where `github_issue_id is not null`
- `webhook_success_rate`: from `webhook_logs` (now populated once Priorities 0–3 land)

**Frontend:** two `recharts` visuals in `frontend/src/pages/AdminDashboard.jsx` — bugs-by-component bar chart, bugs-resolved-per-week trend.

**Also in this phase — unify the two duplicate-detection UX paths** (flagged in the current code):
`AddBugModal.jsx` Step 1 (`handleSearchSimilar`, manual search) and the post-create AI check in `backend/app/routers/bugs.py::create_bug()` (`detect_duplicate_bug`) currently don't talk to each other — a user can search, see nothing, then get flagged as a duplicate right after submitting, with no connection between the two moments. Change the post-create banner copy (in `Dashboard.jsx`/`TesterDashboard.jsx`'s `possible_duplicate` rendering) to something like *"Our AI flagged this after you searched — want to check again?"*

**Acceptance criteria:** `/analytics/overview` numbers match manual counts against your test data; charts render; the duplicate-detection messaging references the earlier search step.

---

## Priority 5 — Data-driven permissions & workflow (~1.5 days)

**Why this priority (lower than it sounds):** genuine architecture credit, but it's the least *visible* item in a live demo — an admin flipping a checkbox to change a permission rule doesn't photograph as well as a notification bell or an automation rule firing. Do it once the higher-visibility items are done, if time remains.

**New tables:**
```sql
create table role_permissions (
  role text not null,
  field text not null,
  editable boolean not null default false,
  primary key (role, field)
);

create table status_transitions (
  role text not null,
  from_status text not null,
  to_status text not null,
  primary key (role, from_status, to_status)
);
```
Seed both to reproduce **exactly** today's behavior first (regression safety) — read the current logic straight out of `backend/app/routers/bugs.py::update_bug()`'s `if role == "tester": ... elif role == "reporter": ... elif role == "developer": ...` chain and translate each branch into rows.

**New file:** `backend/app/services/permissions.py`
```python
def can_edit_field(role: str, field: str) -> bool: ...
def can_transition(role: str, from_status: str, to_status: str) -> bool: ...
```
Cache in memory at startup; add `POST /admin/permissions/reload` rather than re-querying per request.

**Refactor** `update_bug()` in `backend/app/routers/bugs.py` to call these helpers instead of the inline chain. **Keep** the two genuinely relationship-based guards as explicit checks before the generic permission call: "reporter can only edit their own bug" and "only while status = new" — these aren't role rules, they're relationship rules, and collapsing them into the generic table would lose that distinction.

**New admin endpoints:** `GET/PUT /admin/role-permissions`, `GET/PUT /admin/status-transitions`, guarded by `require_role(["admin"])` (already in `backend/app/auth/dependencies.py`).

**Frontend:** one admin page (can live inside `AdminDashboard.jsx`) rendering both tables as checkbox grids.

**Testing:** extend `backend/tests/test_bugs_comments.py`'s existing permission tests (`test_reporter_permission_rules_success`, `test_reporter_permission_rules_disallowed_fields`, `test_developer_patch_any_field`, etc.) to run against the new config-driven path — **all currently-passing tests must still pass unchanged**, since only the source of the rule moves from code to data, not the behavior.

**Acceptance criteria:** an admin flips one checkbox (e.g., allow `tester` to edit `component`) and sees the effect on the next `PATCH /bugs/:id` call with no redeploy.

---

## Priority 6 — Full component migration, accessibility, and signature interactions (~4–5 days)

**Why last:** this is the largest single phase (comparable in size to everything above combined), and everything built in Priorities 2–5 above is already landing on the Priority-1 design-system foundation, so there's no rework being created by deferring this. Do the cheapest, highest-impact sub-items (5e below) first if time runs out entirely.

### 6a. Round out the component library (1 day)
Beyond `<Button>`/`<Badge>`/`<Table>` from Priority 1, add in `frontend/src/components/ui/`:
- `<Card>` / `<GlassPanel>` — formalizes `.glass-card`/`.glass-panel` CSS classes into a component with consistent padding props.
- `<Modal>` — replaces `AddBugModal.jsx`'s bespoke fixed-position overlay; add `Escape`-to-close and focus trapping (currently missing — an accessibility gap).
- `<Input>` / `<Select>` / `<Textarea>` — replace raw `.input-field` usages with consistent focus rings, error states, label association.
- `<Toast>` — replaces every `alert(...)` call. Confirmed locations: `AddBugModal.jsx` (file upload failure, submit failure), `Dashboard.jsx` (mark-resolved failure, Discord save failure), `TesterDashboard.jsx` (mark-fixed/send-back failure). A blocking browser `alert()` is one of the fastest "this is a prototype" signals to a judge.
- `<EmptyState>` — one consistent pattern replacing one-offs like `TesterDashboard.jsx`'s "No bugs in the testing queue right now. 🎉" and `BugList.jsx`'s "No bugs found. System is clean!".
- `<Skeleton>` — replaces plain "Loading bugs..." / "Loading..." text across `BugList.jsx`, `Dashboard.jsx`, `AdminDashboard.jsx`, `TesterDashboard.jsx`.

### 6b. Accessibility pass (0.5 day, layered into 6a)
- Verify every token color pairing meets WCAG 2.1 AA contrast (≥4.5:1 body text).
- Full keyboard reachability: visible focus rings everywhere (`--border-focus` token already exists, apply it consistently), `Escape` closes modals, `Enter` submits, sane tab order.
- `aria-label`s on icon-only buttons — confirmed missing on the logout icon button in `Layout.jsx` and the modal close `X` button in `AddBugModal.jsx`.

### 6c. Page-by-page migration (1.5–2 days)
| Page | What changes |
|---|---|
| `Layout.jsx` | Notification bell (from Priority 2) + command-palette trigger (6d) in the header |
| `Auth.jsx` | Raw inputs → `<Input>`; inline validation states |
| `Dashboard.jsx` | KPI cards → `<Card>`; bug tables → shared `<Table>`/row component |
| `BugList.jsx` / `TesterDashboard.jsx` | Swap to shared `<Table>` — expect to delete 200+ duplicated lines |
| `AddBugModal.jsx` | Rebuild on `<Modal>` + `<Input>`/`<Select>`/`<Textarea>` + `<Toast>` |
| `AdminDashboard.jsx` | Priority 4's charts styled with the same tokens |
| `NotificationPreferences.jsx` / `AutomationRules.jsx` | Already built against the component library in Priorities 2–3 — no rework here |

### 6d. Signature interactions (0.5–1 day — do these first if this phase gets cut short)
- `Cmd/Ctrl+K` command palette: create bug / jump to bug by title / jump to nav section.
- Toast notifications replacing every `alert()` (very visible in a live demo).
- Skeleton loaders replacing "Loading..." text.
- Subtle CSS transition on status-badge changes.

**Acceptance criteria:** no page contains a raw `alert()` call; `BugList.jsx`/`Dashboard.jsx`/`TesterDashboard.jsx` render bug rows through the same shared table component; every interactive element is keyboard-reachable; `Cmd/Ctrl+K` opens a working command palette from any page.

---

## Summary: what to do this week, in order

1. **Today:** Priority 0 (0.1–0.5) — fix the build, dedupe the GitHub paths, fix docs. ~3–4 hrs.
2. **Today/tomorrow:** Priority 0.5 (uploads to Supabase Storage) + Priority 1 (design tokens + Button/Badge/Table). ~1.5 days.
3. **Days 2–3:** Priority 2 — search upgrade + notifications (in-app + email). This is your biggest documentation-vs-code gap and your explicit ask.
4. **Day 3–4:** Priority 3 — automation rules (highest Innovation payoff per hour).
5. **Day 4:** Priority 4 — analytics + duplicate-detection UX unification.
6. **If time remains:** Priority 5 (data-driven permissions), then Priority 6 (full component migration/accessibility/command palette) — do 6d's signature interactions first if you're short on time, they're the best visual payoff per hour.
