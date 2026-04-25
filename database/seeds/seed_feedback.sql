-- ============================================================
-- Seed: plan_feedback
--
-- 6 realistic scientist corrections across all 4 experiment domains.
-- These seed rows allow the RAG pipeline to work from day 1
-- even before any real scientist has used the app.
--
-- IMPORTANT: Embeddings are populated separately by
-- scripts/generate_embeddings.js after inserting these rows.
-- Rows without embeddings are ignored by the RAG retrieval function.
--
-- The plan_id references a seed plan from seed_plans.sql.
-- ============================================================

DO $$
DECLARE
  seed_plan_id UUID := '00000000-0000-0000-0001-000000000001';
BEGIN

-- ── Correction 1: Gut Health — Protocol ──────────────────────────────────────
INSERT INTO plan_feedback (
  plan_id, reviewer, section, rating,
  original_content, correction, correction_reason,
  experiment_type, domain
) VALUES (
  seed_plan_id, 'Dr. Sarah Chen (seed)', 'protocol', 2,
  'Incubate FITC-dextran solution at 37°C for 4 hours then read fluorescence at room temperature.',
  'After the 4-hour gavage window, collect blood via cardiac puncture. Centrifuge immediately at 4°C, 600×g, 10 minutes. Transfer plasma to pre-chilled tubes. Read fluorescence immediately — keep samples on ice throughout. Never let samples warm up before reading.',
  'FITC signal degrades rapidly at room temperature after blood collection. Every minute at RT after centrifugation can lose 3-5% signal. This directly invalidates the permeability measurement.',
  'FITC-dextran gut permeability assay', 'gut_health'
);

-- ── Correction 2: Gut Health — Materials ─────────────────────────────────────
INSERT INTO plan_feedback (
  plan_id, reviewer, section, rating,
  original_content, correction, correction_reason,
  experiment_type, domain
) VALUES (
  seed_plan_id, 'Dr. Sarah Chen (seed)', 'materials', 2,
  'FITC-Dextran 4kDa | Sigma-Aldrich | FD4-1G | 100mg | $185',
  'Order FITC-Dextran 4kDa (FD4-1G) at minimum 500mg for n=20 mice. Account for gavage dose of 600mg/kg bodyweight at 0.1mL/10g mouse. A 25g mouse needs ~15mg. For 20 mice plus 20% waste: order at least 360mg. The 1g pack is safer.',
  'The AI ordered too little. With n=20 mice at standard dosing, you need several hundred mg plus wastage. Always order 2x your calculated minimum for expensive fluorescent probes.',
  'FITC-dextran gut permeability assay', 'gut_health'
);

-- ── Correction 3: Cell Biology — Protocol ────────────────────────────────────
INSERT INTO plan_feedback (
  plan_id, reviewer, section, rating,
  original_content, correction, correction_reason,
  experiment_type, domain
) VALUES (
  seed_plan_id, 'Prof. Marcus Webb (seed)', 'protocol', 2,
  'Add trehalose cryoprotectant to cells and immediately transfer to -80°C freezer.',
  'Add trehalose to cells at 4°C with gentle mixing. Allow 30 minute equilibration at 4°C before beginning freeze-down. Use a controlled-rate freezer or Mr. Frosty isopropanol device at -1°C/minute. Transfer to -80°C overnight. Only move to liquid nitrogen after 24h. Rapid freeze rates cause trehalose crystal damage that eliminates the membrane stabilisation benefit entirely.',
  'Trehalose requires slow, controlled cooling to provide membrane stabilisation. The AI protocol would freeze cells too fast — eliminating the point of the experiment.',
  'HeLa cell cryopreservation trehalose assay', 'cell_biology'
);

-- ── Correction 4: Cell Biology — Validation ──────────────────────────────────
INSERT INTO plan_feedback (
  plan_id, reviewer, section, rating,
  original_content, correction, correction_reason,
  experiment_type, domain
) VALUES (
  seed_plan_id, 'Prof. Marcus Webb (seed)', 'validation', 3,
  'Use Student t-test to compare trehalose vs DMSO viability. p < 0.05 = success.',
  'With small n and likely unequal variance, use Welch t-test (not Student t-test). Minimum 3 independent biological replicates required. Measure both Trypan Blue exclusion AND a metabolic assay (MTT or CellTiter-Glo) as dual viability endpoints.',
  'Student t-test assumes equal variance. Single-endpoint viability misses sublethal damage. Dual endpoints + biological replicates are required for a defensible conclusion.',
  'HeLa cell cryopreservation viability comparison', 'cell_biology'
);

-- ── Correction 5: Diagnostics — Protocol ─────────────────────────────────────
INSERT INTO plan_feedback (
  plan_id, reviewer, section, rating,
  original_content, correction, correction_reason,
  experiment_type, domain
) VALUES (
  seed_plan_id, 'Dr. Amara Osei (seed)', 'protocol', 2,
  'Pipette whole blood sample onto paper biosensor. Incubate 10 minutes. Read electrochemical signal.',
  'Pre-wet the nitrocellulose membrane with 5µL of running buffer (PBS + 0.1% Tween-20) 60 seconds before sample application. This prevents the blood matrix from clogging the paper pores. Apply blood sample only after pre-wetting step is complete and membrane surface appears uniformly damp.',
  'Paper membranes fail with whole blood when run dry. Pre-wetting is the critical step that preserves pore flow and antibody accessibility.',
  'paper electrochemical biosensor CRP detection', 'diagnostics'
);

-- ── Correction 6: Climate — Budget ───────────────────────────────────────────
INSERT INTO plan_feedback (
  plan_id, reviewer, section, rating,
  original_content, correction, correction_reason,
  experiment_type, domain
) VALUES (
  seed_plan_id, 'Dr. James Kowalski (seed)', 'budget', 2,
  'Potentiostat (3-electrode setup): $200 equipment access fee',
  'Dedicated potentiostat for continuous BES chronoamperometry is typically $300-500/week core access, or $8k-12k to purchase. For a 14+ day continuous run, budget at least $4,200 in dedicated potentiostat access. Also add CO2 regulator ($250) and gas-tight fittings ($180).',
  'Continuous multi-day chronoamperometry requires dedicated equipment access; the $200 estimate applies to short CV runs. This was a major budget miss in pilot BES experiments.',
  'Sporomusa bioelectrochemical CO2 fixation', 'climate'
);

END $$;

