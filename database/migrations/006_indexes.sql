-- ============================================================
-- Migration 006: Performance indexes
--
-- IMPORTANT: ivfflat indexes require the table to have data to
-- set the `lists` parameter correctly. For a hackathon with < 1000
-- rows, lists=10 is fine. For production: lists = sqrt(row_count).
--
-- Run this AFTER seeding — not before. If you run before data,
-- the index builds on empty table which is fine but won't optimise.
-- ============================================================

-- ── experiment_plans indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plans_hypothesis_hash
  ON experiment_plans (hypothesis_hash);

CREATE INDEX IF NOT EXISTS idx_plans_domain
  ON experiment_plans (domain);

CREATE INDEX IF NOT EXISTS idx_plans_status
  ON experiment_plans (status);

CREATE INDEX IF NOT EXISTS idx_plans_created_at
  ON experiment_plans (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plans_embedding
  ON experiment_plans
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- ── plan_feedback indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_section_domain
  ON plan_feedback (section, domain);

CREATE INDEX IF NOT EXISTS idx_feedback_rating
  ON plan_feedback (rating);

CREATE INDEX IF NOT EXISTS idx_feedback_plan_id
  ON plan_feedback (plan_id);

CREATE INDEX IF NOT EXISTS idx_feedback_embedding
  ON plan_feedback
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- ── tavily_cache indexes ──────────────────────────────────────────────────────
-- NOTE: Postgres requires index predicates to use IMMUTABLE expressions.
-- `now()` is VOLATILE, so `WHERE expires_at > now()` is invalid in a partial index.
-- A plain btree index on expires_at still accelerates expiry filtering in queries.
CREATE INDEX IF NOT EXISTS idx_cache_expires_at
  ON tavily_cache (expires_at);

