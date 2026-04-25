-- ============================================================
-- Seed: experiment_plans
--
-- 2 seed plans for frontend development. These give the UI
-- something to render without needing to run the full pipeline.
-- They use fixed UUIDs so the feedback seed can reference them.
--
-- NOTE: Embeddings are left NULL here — they are backfilled by
-- scripts/generate_embeddings.js
-- ============================================================

INSERT INTO experiment_plans (
  id,
  hypothesis,
  hypothesis_hash,
  domain,
  parsed_hypothesis,
  novelty_signal,
  novelty_confidence,
  literature_refs,
  protocol,
  materials,
  materials_subtotal,
  budget,
  timeline,
  validation,
  status
) VALUES (
  '00000000-0000-0000-0001-000000000001',

  'Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin.',

  'a1b2c3d4e5f6a1b2',

  'gut_health',

  '{
    "intervention": "Lactobacillus rhamnosus GG supplementation",
    "outcome": "reduction in intestinal permeability",
    "threshold": "30% reduction",
    "organism_or_substrate": "C57BL/6 mice",
    "mechanism": "upregulation of tight junction proteins claudin-1 and occludin",
    "assay_method": "FITC-dextran assay",
    "domain": "gut_health",
    "control_condition": "unsupplemented C57BL/6 mice",
    "experiment_type": "probiotic intestinal permeability mouse model",
    "confidence": "high"
  }'::jsonb,

  'similar_work_exists',
  'high',

  '[
    {
      "title": "Lactobacillus rhamnosus GG reduces intestinal permeability and modulates microbiota",
      "url": "https://pubmed.ncbi.nlm.nih.gov/example1",
      "relevance": "Uses the same strain and FITC-dextran assay in C57BL/6 mice but measures a different outcome timepoint."
    }
  ]'::jsonb,

  '{
    "total_duration": "6 weeks total (4 weeks supplementation + analysis)",
    "steps": [
      {
        "step_number": 1,
        "title": "Animal Housing and Acclimatisation",
        "description": "House 20 male C57BL/6 mice (8 weeks, 20-25g) in groups of 5, 12h light/dark cycle, ad libitum water. Allow 7-day acclimatisation before any intervention.",
        "duration": "7 days",
        "critical_notes": "Acclimatisation reduces stress-induced gut permeability changes that would confound baseline measurements."
      }
    ]
  }'::jsonb,

  '[]'::jsonb,
  0,

  '{
    "materials_subtotal": 4450,
    "labor_estimate_usd": 1190,
    "equipment_access_usd": 350,
    "contingency_usd": 786,
    "total_usd": 6029,
    "currency": "USD"
  }'::jsonb,

  '{
    "total_weeks": 8,
    "phases": []
  }'::jsonb,

  '{
    "primary_success_criterion": "Mean plasma FITC-dextran concentration in the LGG group is at least 30% lower than the control group (p < 0.05)."
  }'::jsonb,

  'complete'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO experiment_plans (
  id,
  hypothesis,
  hypothesis_hash,
  domain,
  parsed_hypothesis,
  novelty_signal,
  novelty_confidence,
  literature_refs,
  protocol,
  materials,
  materials_subtotal,
  budget,
  timeline,
  validation,
  status
) VALUES (
  '00000000-0000-0000-0002-000000000002',

  'A paper-based electrochemical CRP biosensor with a nitrocellulose pre-wetting step will improve CRP capture efficiency by at least 40% in whole blood compared to a dry-membrane protocol, measured by signal-to-noise ratio at 10 minutes, due to reduced matrix clogging.',

  'b2c3d4e5f6a1b2c3',

  'diagnostics',

  '{
    "intervention": "nitrocellulose pre-wetting step",
    "outcome": "improved CRP capture efficiency in whole blood",
    "threshold": "40% improvement",
    "organism_or_substrate": "human whole blood (spiked CRP)",
    "assay_method": "paper electrochemical biosensor readout",
    "domain": "diagnostics",
    "control_condition": "dry membrane protocol",
    "experiment_type": "paper electrochemical biosensor CRP detection",
    "confidence": "medium"
  }'::jsonb,

  'not_found',
  'medium',

  '[]'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  0,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  'complete'
)
ON CONFLICT (id) DO NOTHING;

