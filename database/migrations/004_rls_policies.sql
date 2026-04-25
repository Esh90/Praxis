-- ============================================================
-- Migration 004: Row Level Security policies
--
-- RLS is enabled on all tables. For the hackathon demo:
--   - experiment_plans: public read (anyone can view plans)
--   - plan_feedback: public read + insert (scientists can submit)
--   - tavily_cache: read-only via anon key
--
-- The backend uses the SERVICE ROLE KEY which bypasses RLS entirely.
-- RLS only applies to requests made with the ANON KEY (frontend direct).
--
-- For a production system, you would add user_id-scoped policies.
-- ============================================================

-- ── experiment_plans ─────────────────────────────────────────────────────────
ALTER TABLE experiment_plans ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read any plan (demo needs this for /plan/[id] to work)
CREATE POLICY "plans_public_read"
  ON experiment_plans
  FOR SELECT
  USING (true);

-- Only service role can insert/update/delete (handled by backend)
-- No INSERT/UPDATE/DELETE policy for anon = anon cannot write directly
-- This forces all writes through the backend (which uses service role key)

-- ── plan_feedback ─────────────────────────────────────────────────────────────
ALTER TABLE plan_feedback ENABLE ROW LEVEL SECURITY;

-- Allow reading all feedback (for the review page to show past corrections)
CREATE POLICY "feedback_public_read"
  ON plan_feedback
  FOR SELECT
  USING (true);

-- Allow anon INSERT (scientists can submit feedback without logging in)
-- The backend validates the body before inserting, so this is safe
CREATE POLICY "feedback_anon_insert"
  ON plan_feedback
  FOR INSERT
  WITH CHECK (true);

-- ── tavily_cache ──────────────────────────────────────────────────────────────
ALTER TABLE tavily_cache ENABLE ROW LEVEL SECURITY;

-- Cache is read-only via anon key — writes only via service role
CREATE POLICY "cache_public_read"
  ON tavily_cache
  FOR SELECT
  USING (expires_at > now());  -- only return non-expired entries

