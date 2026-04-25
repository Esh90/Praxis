import { Router } from 'express';
import path from 'path';
import { pathToFileURL } from 'url';

import { importAgentsOrchestrator } from '../services/agentsRunner.js';
import { buildPraxisPlanUi, slugDomainFromUi } from '../services/praxisMapper.js';
import { getSupabaseAdmin } from '../services/supabaseAdmin.js';
import { embedText384 } from '../services/localEmbedder.js';

export const praxisRouter = Router();

praxisRouter.post('/generate', async (req, res) => {
  try {
    const hypothesis = String(req.body?.hypothesis || '').trim();
    const domainUi = String(req.body?.domain || '').trim();

    if (!hypothesis) return res.status(400).json({ ok: false, error: 'hypothesis is required' });
    if (!domainUi) return res.status(400).json({ ok: false, error: 'domain is required' });

    const { runPipeline } = await importAgentsOrchestrator();
    const pipelineResult = await runPipeline(hypothesis, { skipQC: false, skipFeedback: false });

    if (!pipelineResult?.finalPlan) {
      return res.status(500).json({
        ok: false,
        error: 'Pipeline failed before producing a plan',
        pipeline: pipelineResult,
      });
    }

    // If UI domain differs from parser domain, override parsed domain for downstream consistency.
    const slug = slugDomainFromUi(domainUi);
    if (pipelineResult.finalPlan.parsed_hypothesis && slug !== 'other') {
      pipelineResult.finalPlan.parsed_hypothesis.domain = slug;
    }

    const supabase = getSupabaseAdmin();
    let planId = null;

    if (supabase) {
      const fp = pipelineResult.finalPlan;
      const qc = fp.novelty;

      const row = {
        hypothesis,
        hypothesis_hash: null,
        domain: fp.parsed_hypothesis?.domain || slug,
        parsed_hypothesis: fp.parsed_hypothesis,
        novelty_signal: qc?.novelty_signal || 'not_found',
        novelty_confidence: qc?.confidence || 'low',
        literature_refs: qc?.references || [],
        protocol: fp.protocol,
        materials: fp.materials || [],
        materials_subtotal: Number(fp.materials_subtotal || 0) || 0,
        materials_disclaimer: fp.materials_disclaimer || null,
        budget: fp.budget,
        timeline: fp.timeline,
        validation: fp.validation,
        status: pipelineResult.errors?.length ? 'complete' : 'complete',
        pipeline_warnings: (pipelineResult.errors || []).map((e) => e.stage),
        generation_ms: pipelineResult.durationMs || null,
      };

      const { data, error } = await supabase.from('experiment_plans').insert(row).select('id').single();
      if (error) {
        console.warn('[praxis] Supabase insert failed (plan still returned to client):', error.message);
      } else {
        planId = data?.id || null;
      }
    } else {
      console.warn('[praxis] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping DB persistence');
    }

    const plan = buildPraxisPlanUi({ hypothesis, domainUi, pipelineResult, planId });
    return res.status(200).json(plan);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

praxisRouter.post('/feedback', async (req, res) => {
  try {
    const plan_id = req.body?.plan_id ? String(req.body.plan_id) : null;
    const section = String(req.body?.section || '').trim();
    const rating = Number(req.body?.rating);
    const original_content = String(req.body?.original_content || '').trim();
    const correction = String(req.body?.correction || '').trim();
    const correction_reason = String(req.body?.correction_reason || '').trim();
    const experiment_type = String(req.body?.experiment_type || '').trim();
    const domain = String(req.body?.domain || 'other').trim();
    const reviewer = String(req.body?.reviewer || 'anonymous').trim();

    if (!plan_id) return res.status(400).json({ ok: false, error: 'plan_id is required' });
    if (!section) return res.status(400).json({ ok: false, error: 'section is required' });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ ok: false, error: 'rating must be 1-5' });
    }
    if (!original_content) return res.status(400).json({ ok: false, error: 'original_content is required' });
    if (!correction) return res.status(400).json({ ok: false, error: 'correction is required' });

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(500).json({ ok: false, error: 'Supabase admin client not configured' });
    }

    const textToEmbed = `${section} ${experiment_type} ${correction}`;
    const embedding = await embedText384(textToEmbed);

    const row = {
      plan_id,
      reviewer,
      section,
      rating,
      original_content,
      correction,
      correction_reason,
      experiment_type,
      domain,
      embedding,
    };

    const { data, error } = await supabase.from('plan_feedback').insert(row).select('id').single();
    if (error) return res.status(500).json({ ok: false, error: error.message });

    // Also append to local agents cache for immediate few-shot retrieval in-process demos.
    try {
      const { agentsRoot } = await importAgentsOrchestrator();
      const feedbackStoreUrl = pathToFileURL(path.join(agentsRoot, 'lib', 'feedbackStore.js')).href;
      const { addFeedback } = await import(feedbackStoreUrl);
      await addFeedback({
        section,
        domain,
        experiment_type,
        original: original_content,
        correction,
        reason: correction_reason,
        rating,
      });
    } catch {
      // optional
    }

    return res.status(201).json({ ok: true, id: data?.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
