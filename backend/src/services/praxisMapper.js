function titleCaseDomain(domainSlug) {
  switch (domainSlug) {
    case 'diagnostics':
      return 'Diagnostics';
    case 'gut_health':
      return 'Gut Health';
    case 'cell_biology':
      return 'Cell Biology';
    case 'climate':
      return 'Climate';
    default:
      return 'Other';
  }
}

export function uiDomainFromSlug(domainSlug) {
  return titleCaseDomain(domainSlug);
}

export function slugDomainFromUi(domainUi) {
  const map = {
    Diagnostics: 'diagnostics',
    'Gut Health': 'gut_health',
    'Cell Biology': 'cell_biology',
    Climate: 'climate',
    Other: 'other',
  };
  return map[domainUi] || 'other';
}

export function noveltyUiFromAgent(qcData) {
  const signal = qcData?.novelty_signal;
  if (signal === 'exact_match_found') return 'Exact Match';
  if (signal === 'similar_work_exists') return 'Similar Exists';
  return 'Not Found';
}

function yearFromUrl(url) {
  const m = String(url || '').match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : new Date().getFullYear();
}

function doiFromUrl(url) {
  const u = String(url || '');
  if (u.includes('doi.org/')) return u.split('doi.org/')[1]?.split('?')[0] || u;
  if (u.toLowerCase().includes('doi:')) return u.split(':').slice(-1)[0]?.trim() || u;
  return u || 'n/a';
}

function sourceLabelFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('pubmed') || host.includes('ncbi.nlm.nih')) return 'PubMed';
    if (host.includes('arxiv')) return 'arXiv';
    if (host.includes('biorxiv') || host.includes('medrxiv')) return 'bioRxiv / medRxiv';
    if (host.includes('nature.com')) return 'Nature';
    if (host.includes('sciencedirect')) return 'ScienceDirect';
    if (host.includes('cell.com')) return 'Cell';
    if (host.includes('frontiersin')) return 'Frontiers';
    if (host.includes('plos')) return 'PLOS';
    return host;
  } catch {
    return 'Source';
  }
}

export function referencesUiFromAgent(refs) {
  const list = Array.isArray(refs) ? refs : [];
  return list.slice(0, 3).map((r) => {
    const url = String(r.url || '');
    return {
      title: r.title || 'Reference',
      authors: 'Literature match',
      year: yearFromUrl(url),
      doi: doiFromUrl(url),
      url,
      source: sourceLabelFromUrl(url),
      relevance: typeof r.relevance === 'number' ? r.relevance : null,
    };
  });
}

function parseDurationToMinutes(duration) {
  const s = String(duration || '').toLowerCase();
  const m = s.match(/([\d.]+)/);
  const n = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 60;

  if (s.includes('min')) return Math.round(n);
  if (s.includes('hour') || s.includes('hr')) return Math.round(n * 60);
  if (s.includes('day')) return Math.round(n * 24 * 60);
  if (s.includes('week')) return Math.round(n * 7 * 24 * 60);
  return Math.round(n);
}

export function protocolUiFromAgent(protocolObj) {
  const steps = protocolObj?.steps || [];
  return steps.map((st) => ({
    step: st.step_number,
    title: st.title,
    description: st.description,
    duration_min: parseDurationToMinutes(st.duration),
    critical_note: st.critical_note || st.note || null,
  }));
}

export function materialsUiFromAgent(materialsArr) {
  const mats = Array.isArray(materialsArr) ? materialsArr : [];
  return mats.map((m, idx) => ({
    name: m.name || `Material ${idx + 1}`,
    category: m.category || 'Reagent',
    supplier: m.supplier || 'TBD',
    catalog: m.catalog_number || m.catalog || 'TBD',
    cost: Number(m.total_cost_usd ?? m.unit_cost_usd ?? 0) || 0,
    unit_cost: Number(m.unit_cost_usd ?? 0) || null,
    quantity: Number(String(m.quantity || '1').replace(/[^\d.]/g, '')) || 1,
    unit: m.unit || 'ea',
  }));
}

export function budgetUiFromAgent(budgetObj, materialsSubtotal) {
  const labor = Math.max(0, Number(budgetObj?.labor_estimate_usd || 0) || 0);
  const equipment = Math.max(0, Number(budgetObj?.equipment_access_usd || 0) || 0);
  // Always trust the upstream materials subtotal (Agent 3) over whatever
  // the budget LLM put in budgetObj.materials_subtotal — the latter is
  // frequently hallucinated. Fall back only if Agent 3 didn't produce one.
  const authoritativeMaterials = Number(materialsSubtotal);
  const materials = Number.isFinite(authoritativeMaterials) && authoritativeMaterials > 0
    ? authoritativeMaterials
    : Math.max(0, Number(budgetObj?.materials_subtotal || 0) || 0);

  const computedBase = labor + materials + equipment;
  const contingencyFromObj = Number(budgetObj?.contingency_usd);
  const contingency = Number.isFinite(contingencyFromObj) && contingencyFromObj > 0
    ? contingencyFromObj
    : Math.round(computedBase * 0.15);

  const reportedTotal = Number(budgetObj?.total_usd);
  const computedTotal = computedBase + contingency;
  // Reject a reported total if it's clearly bogus — e.g. $1 when materials
  // alone are $1,800 — and fall back to the derived sum. We accept the
  // LLM-provided total only when it's at least 60% of the line-item floor.
  const grand =
    Number.isFinite(reportedTotal) && reportedTotal >= computedBase * 0.6
      ? reportedTotal
      : computedTotal;

  return {
    labor,
    materials,
    contingency,
    grand_total: grand,
    currency: budgetObj?.currency || 'USD',
    breakdown_notes: 'Totals are estimates; verify quotes, access fees, and staffing assumptions before procurement.',
  };
}

export function timelineUiFromAgent(timelineObj) {
  const phases = timelineObj?.phases || [];
  return phases.map((p) => ({
    phase: p.phase || 'Phase',
    weeks: Number(p.duration_weeks || 1) || 1,
    start_week: Number(p.start_week || 1) || 1,
    activities: Array.isArray(p.activities) ? p.activities.map(String) : [],
    dependencies: Array.isArray(p.dependencies) ? p.dependencies.map(String) : [],
  }));
}

export function validationUiFromAgent(validationObj) {
  const controls = Array.isArray(validationObj?.controls) ? validationObj.controls.map(String) : [];
  const failureModes = Array.isArray(validationObj?.failure_modes) ? validationObj.failure_modes : [];
  const risks = failureModes.map((fm) => ({ risk: String(fm), mitigation: 'Mitigate via pilot runs, tighter QC checkpoints, and documented go/no-go criteria.' }));

  return {
    statistical_power: 0.8,
    sample_size_justification: String(validationObj?.sample_size_rationale || validationObj?.primary_success_criterion || 'See protocol and validation tabs for acceptance criteria.'),
    controls: controls.length > 0 ? controls : ['Positive/negative controls as specified in protocol', 'Assay calibration standards'],
    primary_success_criterion: validationObj?.primary_success_criterion || null,
    significance_test: validationObj?.statistical_test || validationObj?.significance_test || null,
    risks:
      risks.length > 0
        ? risks
        : [
            { risk: 'Assay variability / batch effects', mitigation: 'Randomize runs; include bridge controls; pre-specify stopping rules.' },
            { risk: 'Supply chain delays', mitigation: 'Order long-lead items early; identify substitute SKUs.' },
          ],
  };
}

export function buildPraxisPlanUi({ hypothesis, domainUi, pipelineResult, planId }) {
  const fp = pipelineResult?.finalPlan;
  const parsed = fp?.parsed_hypothesis || {};
  const qc = fp?.novelty || pipelineResult?.stages?.qc?.data || null;

  // ALWAYS prefer the Agent-0 inferred domain — `domainUi` is now just a
  // legacy passthrough from older clients and should never override the
  // model's classification.
  const domainSlug = parsed.domain || slugDomainFromUi(domainUi);
  const domainForUi = uiDomainFromSlug(domainSlug);

  return {
    novelty: {
      status: noveltyUiFromAgent(qc),
      references: referencesUiFromAgent(qc?.references),
      confidence: qc?.confidence || null,
      summary: qc?.summary || null,
      raw: qc,
    },
    protocol: protocolUiFromAgent(fp?.protocol),
    materials: materialsUiFromAgent(fp?.materials),
    budget: budgetUiFromAgent(fp?.budget, fp?.materials_subtotal),
    timeline: timelineUiFromAgent(fp?.timeline),
    validation: validationUiFromAgent(fp?.validation),
    meta: {
      plan_id: planId,
      hypothesis,
      domain: domainForUi,
      experiment_type: parsed.experiment_type || fp?.metadata?.experiment_type || '',
      plan_title: fp?.plan_title || null,
      executive_summary: fp?.executive_summary || null,
      generated_at: fp?.metadata?.generated_at || new Date().toISOString(),
      duration_ms: pipelineResult?.durationMs ?? null,
      pipeline_errors: pipelineResult?.errors?.length ?? 0,
    },
  };
}
