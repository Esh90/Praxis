-- ============================================================
-- Migration 001: experiment_plans table
--
-- Stores every generated experiment plan.
-- Each row is one full pipeline output.
-- The embedding column enables future similarity search
-- (e.g. "find me plans similar to this hypothesis").
-- ============================================================

CREATE TABLE IF NOT EXISTS experiment_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Core hypothesis fields
  hypothesis        TEXT NOT NULL,
  hypothesis_hash   TEXT,             -- SHA256 hex for dedup + cache lookup

  -- Domain classification (from Agent 0)
  domain            TEXT CHECK (domain IN (
                      'diagnostics',
                      'gut_health',
                      'cell_biology',
                      'climate',
                      'other'
                    )),

  -- Full parsed hypothesis JSON (from Agent 0)
  -- Shape: {intervention, outcome, threshold, organism_or_substrate,
  --          mechanism, assay_method, control_condition, experiment_type, confidence}
  parsed_hypothesis JSONB,

  -- Literature QC results (from Agent 1 + Tavily)
  -- CRITICAL: must match exactly what agents emit
  novelty_signal    TEXT CHECK (novelty_signal IN (
                      'not_found',
                      'similar_work_exists',
                      'exact_match_found'
                    )),
  novelty_confidence TEXT CHECK (novelty_confidence IN ('high', 'medium', 'low')),
  literature_refs   JSONB DEFAULT '[]'::jsonb,
                    -- Shape: [{title, url, relevance}]

  -- Experiment plan sections (from Agents 2-5)
  -- Each is a complete JSON object matching the agent's output schema
  protocol          JSONB,
                    -- Shape: {total_duration, steps: [{step_number, title, description, duration, critical_notes}]}
  materials         JSONB DEFAULT '[]'::jsonb,
                    -- Shape: [{name, category, supplier, catalog_number, quantity, unit_cost_usd, total_cost_usd, notes, verified}]
  materials_subtotal NUMERIC(10, 2) DEFAULT 0,
  materials_disclaimer TEXT,
  budget            JSONB,
                    -- Shape: {line_items, materials_subtotal, labor_estimate_usd, equipment_access_usd, contingency_usd, total_usd, currency}
  timeline          JSONB,
                    -- Shape: {total_weeks, phases: [{phase, start_week, duration_weeks, activities, dependencies}]}
  validation        JSONB,
                    -- Shape: {primary_success_criterion, secondary_endpoints, statistical_approach, ...}

  -- Embedding for similarity search (384-dim: Xenova/all-MiniLM-L6-v2)
  -- Populated by generate_embeddings.js or backend on plan save
  embedding         vector(384),

  -- Pipeline metadata
  status            TEXT NOT NULL DEFAULT 'complete'
                    CHECK (status IN ('generating', 'complete', 'failed')),
  pipeline_warnings JSONB DEFAULT '[]'::jsonb,
                    -- List of stage keys that had non-fatal errors
  generation_ms     INTEGER,         -- How long the full pipeline took

  -- Optional: link to user if auth is added later
  user_id           UUID DEFAULT NULL
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER experiment_plans_updated_at
  BEFORE UPDATE ON experiment_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE experiment_plans IS
  'One row per generated experiment plan. Core table of the Praxis system.';
COMMENT ON COLUMN experiment_plans.embedding IS
  '384-dimension vector from Xenova/all-MiniLM-L6-v2. Used for similarity search.';
COMMENT ON COLUMN experiment_plans.hypothesis_hash IS
  'SHA256 of normalised hypothesis text. Used for cache dedup in tavily_cache.';

