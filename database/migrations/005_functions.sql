-- ============================================================
-- Migration 005: SQL Functions
--
-- These are the core database functions for the RAG pipeline.
-- Called directly from the backend via Supabase RPC.
-- ============================================================

-- ── Function 1: RAG Feedback Retrieval ───────────────────────────────────────
--
-- The core RAG query. Given a hypothesis embedding and domain,
-- returns the top N most similar corrections from plan_feedback.
-- Used by the agents' few-shot injection system.
--
-- Called from backend via: supabase.rpc('get_relevant_feedback', {...})
--
-- Parameters:
--   query_embedding  vector(384)  — embedding of the current hypothesis
--   filter_domain    text         — domain to filter by
--   filter_section   text         — which section we're generating
--   max_results      int          — how many corrections to return (default 3)
--
-- Returns rows of corrections ordered by cosine similarity (most similar first)
-- Only returns corrections with rating <= 3 (i.e. AI was actually wrong)

CREATE OR REPLACE FUNCTION get_relevant_feedback(
  query_embedding   vector(384),
  filter_domain     text,
  filter_section    text,
  max_results       int DEFAULT 3
)
RETURNS TABLE (
  id                uuid,
  section           text,
  original_content  text,
  correction        text,
  correction_reason text,
  experiment_type   text,
  domain            text,
  rating            smallint,
  applied_count     int,
  similarity        float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    pf.id,
    pf.section,
    pf.original_content,
    pf.correction,
    pf.correction_reason,
    pf.experiment_type,
    pf.domain,
    pf.rating,
    pf.applied_count,
    1 - (pf.embedding <=> query_embedding) AS similarity
  FROM plan_feedback pf
  WHERE
    pf.embedding IS NOT NULL
    AND pf.section = filter_section
    AND (pf.domain = filter_domain OR filter_domain = 'other')
    AND pf.rating <= 3
    AND pf.correction IS NOT NULL
    AND length(pf.correction) > 10
  ORDER BY pf.embedding <=> query_embedding ASC
  LIMIT max_results;
$$;

COMMENT ON FUNCTION get_relevant_feedback IS
  'RAG retrieval: finds most similar past scientist corrections for few-shot injection.
   Filters by section and domain before vector similarity. Returns top N by cosine similarity.';

-- ── Function 2: Increment applied_count ──────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_feedback_applied(feedback_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE plan_feedback
  SET applied_count = applied_count + 1
  WHERE id = feedback_id;
$$;

-- ── Function 3: Find similar plans ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION find_similar_plans(
  query_embedding   vector(384),
  similarity_threshold float DEFAULT 0.85,
  max_results       int DEFAULT 5
)
RETURNS TABLE (
  id              uuid,
  created_at      timestamptz,
  hypothesis      text,
  domain          text,
  novelty_signal  text,
  budget_total    numeric,
  similarity      float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ep.id,
    ep.created_at,
    ep.hypothesis,
    ep.domain,
    ep.novelty_signal,
    (ep.budget->>'total_usd')::numeric AS budget_total,
    1 - (ep.embedding <=> query_embedding) AS similarity
  FROM experiment_plans ep
  WHERE
    ep.embedding IS NOT NULL
    AND ep.status = 'complete'
    AND 1 - (ep.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY ep.embedding <=> query_embedding ASC
  LIMIT max_results;
$$;

-- ── Function 4: Cache lookup by hash ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_tavily_cache(p_hash text)
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT classified_result
  FROM tavily_cache
  WHERE hypothesis_hash = p_hash
    AND expires_at > now()
  LIMIT 1;
$$;

-- ── Function 5: Upsert tavily cache ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_tavily_cache(
  p_hash              text,
  p_results           jsonb,
  p_novelty_signal    text,
  p_classified_result jsonb
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO tavily_cache
    (hypothesis_hash, results, novelty_signal, classified_result, expires_at)
  VALUES
    (p_hash, p_results, p_novelty_signal, p_classified_result, now() + INTERVAL '7 days')
  ON CONFLICT (hypothesis_hash)
  DO UPDATE SET
    results           = EXCLUDED.results,
    novelty_signal    = EXCLUDED.novelty_signal,
    classified_result = EXCLUDED.classified_result,
    expires_at        = now() + INTERVAL '7 days';
$$;

-- ── Function 6: Dashboard stats ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'total_plans',        (SELECT count(*) FROM experiment_plans WHERE status = 'complete'),
    'total_feedback',     (SELECT count(*) FROM plan_feedback),
    'avg_rating',         (SELECT round(avg(rating)::numeric, 2) FROM plan_feedback),
    'low_rated_count',    (SELECT count(*) FROM plan_feedback WHERE rating <= 3),
    'domains',            (
                            SELECT jsonb_object_agg(domain, cnt)
                            FROM (
                              SELECT domain, count(*) as cnt
                              FROM experiment_plans
                              GROUP BY domain
                            ) d
                          ),
    'cache_hit_rate',     (
                            SELECT round(
                              (count(*) FILTER (WHERE expires_at > now()))::numeric /
                              NULLIF(count(*), 0) * 100, 1
                            )
                            FROM tavily_cache
                          ),
    'generated_at',       now()
  );
$$;

