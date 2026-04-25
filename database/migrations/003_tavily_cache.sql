-- ============================================================
-- Migration 003: tavily_cache table
--
-- Caches Tavily literature QC results by hypothesis hash.
-- Prevents burning API credits on repeated identical queries.
-- TTL: 7 days (results expire after this).
--
-- The agents ALSO have a file-based cache in agents/cache/.
-- This table is the persistent, cross-session, cross-process cache.
-- If both are present, file cache is checked first (faster).
-- ============================================================

CREATE TABLE IF NOT EXISTS tavily_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- SHA256 of normalised hypothesis — uniquely identifies a QC query
  hypothesis_hash   TEXT UNIQUE NOT NULL,

  -- The raw Tavily results as returned by the search API
  results           JSONB DEFAULT '[]'::jsonb,

  -- Classified novelty signal from Agent 1
  novelty_signal    TEXT CHECK (novelty_signal IN (
                      'not_found',
                      'similar_work_exists',
                      'exact_match_found'
                    )),

  -- Full classified QC result (novelty_signal, confidence, references, summary)
  classified_result JSONB,

  -- Cache expiry: backend checks this before using cached result
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Scheduled cleanup: auto-delete expired rows
-- (Supabase pg_cron or pg_partman can automate this — manual for now)
COMMENT ON TABLE tavily_cache IS
  'Caches Tavily QC results by hypothesis hash. TTL 7 days. Saves API credits.';

