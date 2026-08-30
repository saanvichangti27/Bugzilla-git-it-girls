-- ============================================================================
-- SCHEMA UPDATES — organized by priority, matching IMPLEMENTATION_PLAN.md
-- Run top to bottom in the Supabase SQL editor. All statements are
-- idempotent (IF NOT EXISTS) so it's safe to re-run.
-- ============================================================================


-- ============================================================================
-- PRIORITY 0 FIXES — these are bugs in your CURRENT schema, not new features.
-- ============================================================================

-- FIX 1: `bugs.attachments` and `bugs.followers` don't exist in your Supabase
-- schema, but `database.py::create_bug()` explicitly does this before insert:
--     supabase_doc.pop("attachments", None)
--     supabase_doc.pop("followers", None)
-- That means on real Supabase (not the in-memory fallback), every attachment
-- upload and every follow/unfollow action is silently discarded on the next
-- `get_bug()`/`get_bugs()` read — it only "works" locally because the
-- in-memory dict keeps it in the same process. Add the columns so the data
-- actually persists:
ALTER TABLE public.bugs
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS followers UUID[] NOT NULL DEFAULT '{}';

-- Once these columns exist, also go back into `database.py::create_bug()` /
-- `update_bug()` and REMOVE the two `.pop("attachments"...)` /
-- `.pop("followers"...)` lines — otherwise the columns exist but nothing
-- ever writes to them and you're in the same broken state with extra steps.

-- FIX 2: `users.discord_username`, `users.github_token`, `users.github_repo`
-- are read/written by `update_user_discord()`, `update_user_github_settings()`,
-- and returned by `UserResponse` (`discord_username: Optional[str]`), but
-- none of these columns exist in your current `users` table. Every Discord
-- link and every per-user GitHub token save is currently failing silently
-- against Supabase (falls through to the in-memory dict only):
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS discord_username VARCHAR NULL,
  ADD COLUMN IF NOT EXISTS github_token VARCHAR NULL,
  ADD COLUMN IF NOT EXISTS github_repo VARCHAR NULL;

-- FIX 3: your comment says "Roles: reporter, developer, admin" but the code
-- (`ROLE_TEST_IDS` in `dependencies.py`, the `role` dropdown in `Auth.jsx`)
-- has a fourth role, `tester`. No constraint enforces this today (it's a
-- plain VARCHAR) so nothing breaks, but update the comment so the schema
-- doesn't keep telling the next reader a stale story:
COMMENT ON COLUMN public.users.role IS
  'One of: reporter, developer, tester, admin. No DB-level CHECK constraint by design — Priority 5''s role_permissions/status_transitions tables are the source of truth for what each role can do, not this column.';

-- Optional integrity improvement (not blocking, do only if convenient):
-- your `bugs.reporter_id` / `assignee_id` are bare UUIDs with no FK to
-- `public.users`. Adding FKs would catch orphaned references, but since
-- `_ensure_uuid()` in `database.py` will happily generate a *deterministic
-- fake UUID* for non-UUID reporter/assignee values (dev/test tokens), a
-- strict FK would break your existing test suite (`test-reporter-token`
-- etc. map to seeded UUIDs, but ad-hoc ones wouldn't exist in `users`).
-- Leave unconstrained unless you also update the test fixtures.


-- ============================================================================
-- PRIORITY 2a — Full-text search on bugs
-- ============================================================================

ALTER TABLE public.bugs
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_bugs_search ON public.bugs USING gin(search_vector);


-- ============================================================================
-- PRIORITY 2b — Notifications (in-app + email preference matrix)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type VARCHAR NOT NULL,       -- 'bug.created' | 'bug.status_changed' | 'comment.added' | 'ai.duplicate_detected' | ...
  relationship VARCHAR NOT NULL,     -- 'reporter' | 'assignee' | 'follower'
  title VARCHAR NOT NULL,
  body TEXT NULL,
  bug_id UUID NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type VARCHAR NOT NULL,
  relationship VARCHAR NOT NULL,
  channel VARCHAR NOT NULL,          -- 'in_app' | 'email'
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, event_type, relationship, channel)
);

-- Seed sensible defaults for every EXISTING user (new signups get seeded in
-- app code — see Priority 2b in the plan — but existing seeded/test users
-- won't have rows unless you backfill them here):
INSERT INTO public.notification_preferences (user_id, event_type, relationship, channel, enabled)
SELECT u.id, e.event_type, e.relationship, c.channel,
       -- in_app defaults on for everything; email defaults on only for the
       -- two highest-signal combinations, off otherwise
       CASE
         WHEN c.channel = 'in_app' THEN TRUE
         WHEN c.channel = 'email' AND e.relationship = 'assignee' AND e.event_type = 'bug.status_changed' THEN TRUE
         WHEN c.channel = 'email' AND e.event_type = 'ai.duplicate_detected' THEN TRUE
         ELSE FALSE
       END AS enabled
FROM public.users u
CROSS JOIN (VALUES
  ('bug.created', 'reporter'),
  ('bug.created', 'follower'),
  ('bug.status_changed', 'reporter'),
  ('bug.status_changed', 'assignee'),
  ('bug.status_changed', 'follower'),
  ('comment.added', 'reporter'),
  ('comment.added', 'assignee'),
  ('comment.added', 'follower'),
  ('ai.duplicate_detected', 'reporter')
) AS e(event_type, relationship)
CROSS JOIN (VALUES ('in_app'), ('email')) AS c(channel)
ON CONFLICT (user_id, event_type, relationship, channel) DO NOTHING;


-- ============================================================================
-- PRIORITY 3 — Automation rules
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  trigger_event_type VARCHAR NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{"field":"priority","op":"=","value":"critical"}]
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,       -- [{"type":"notify_followers"}, {"type":"set_status","value":"in_progress"}]
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger
  ON public.automation_rules(trigger_event_type) WHERE enabled = TRUE;


-- ============================================================================
-- PRIORITY 5 — Data-driven permissions & workflow
-- Seeded to reproduce EXACTLY the current hardcoded logic in
-- backend/app/routers/bugs.py::update_bug(), so switching the code over to
-- read from these tables is a no-behavior-change refactor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role VARCHAR NOT NULL,
  field VARCHAR NOT NULL,
  editable BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (role, field)
);

-- Reporter: only title/description (relationship checks — "own bug only",
-- "only while status=new" — stay as explicit code guards, NOT expressed
-- here, since they're relationship-based, not role-based; see plan Priority 5)
INSERT INTO public.role_permissions (role, field, editable) VALUES
  ('reporter', 'title', TRUE),
  ('reporter', 'description', TRUE)
ON CONFLICT (role, field) DO NOTHING;

-- Tester: status and assignee_id always; title/description only via the
-- same relationship guard as reporter (own bug + status=new) — kept in code
INSERT INTO public.role_permissions (role, field, editable) VALUES
  ('tester', 'status', TRUE),
  ('tester', 'assignee_id', TRUE),
  ('tester', 'title', TRUE),
  ('tester', 'description', TRUE)
ON CONFLICT (role, field) DO NOTHING;

-- Developer: every field (status transition target is further restricted
-- by status_transitions below)
INSERT INTO public.role_permissions (role, field, editable) VALUES
  ('developer', 'title', TRUE),
  ('developer', 'description', TRUE),
  ('developer', 'priority', TRUE),
  ('developer', 'severity', TRUE),
  ('developer', 'component', TRUE),
  ('developer', 'status', TRUE),
  ('developer', 'assignee_id', TRUE)
ON CONFLICT (role, field) DO NOTHING;

-- Admin: every field, unrestricted
INSERT INTO public.role_permissions (role, field, editable) VALUES
  ('admin', 'title', TRUE),
  ('admin', 'description', TRUE),
  ('admin', 'priority', TRUE),
  ('admin', 'severity', TRUE),
  ('admin', 'component', TRUE),
  ('admin', 'status', TRUE),
  ('admin', 'assignee_id', TRUE)
ON CONFLICT (role, field) DO NOTHING;


CREATE TABLE IF NOT EXISTS public.status_transitions (
  role VARCHAR NOT NULL,
  from_status VARCHAR NOT NULL,   -- use '*' to mean "any current status"
  to_status VARCHAR NOT NULL,
  PRIMARY KEY (role, from_status, to_status)
);

-- Today's code only checks the TARGET status for developers (not the
-- source), so from_status is '*' (wildcard) to match that exactly:
INSERT INTO public.status_transitions (role, from_status, to_status) VALUES
  ('developer', '*', 'in_progress'),
  ('developer', '*', 'ready_for_testing')
ON CONFLICT (role, from_status, to_status) DO NOTHING;

-- Tester's `status` field is unrestricted in value today (any status string
-- passes as long as it's a valid StatusEnum) — represent that as a full set:
INSERT INTO public.status_transitions (role, from_status, to_status) VALUES
  ('tester', '*', 'new'),
  ('tester', '*', 'in_progress'),
  ('tester', '*', 'ready_for_testing'),
  ('tester', '*', 'resolved'),
  ('tester', '*', 'closed')
ON CONFLICT (role, from_status, to_status) DO NOTHING;

-- Admin: unrestricted
INSERT INTO public.status_transitions (role, from_status, to_status) VALUES
  ('admin', '*', 'new'),
  ('admin', '*', 'in_progress'),
  ('admin', '*', 'ready_for_testing'),
  ('admin', '*', 'resolved'),
  ('admin', '*', 'closed')
ON CONFLICT (role, from_status, to_status) DO NOTHING;

-- Reporter: no row at all — reporters cannot change status today
-- (status isn't in their allowed-fields set in role_permissions above,
-- so `can_edit_field('reporter','status')` returning false is what blocks
-- it; status_transitions is never consulted for a role that can't touch
-- the field in the first place).


-- ============================================================================
-- VERIFICATION QUERIES — run after the above to sanity-check before
-- switching backend code over to read from these tables
-- ============================================================================

-- Should show non-empty jsonb/array defaults on any existing bug rows:
-- SELECT id, attachments, followers FROM public.bugs LIMIT 5;

-- Should return every existing user with default notification prefs seeded:
-- SELECT count(*) FROM public.notification_preferences;

-- Should return the reporter/tester/developer/admin rows above:
-- SELECT * FROM public.role_permissions ORDER BY role, field;
-- SELECT * FROM public.status_transitions ORDER BY role, to_status;
