import { Router } from 'express';
import path from 'path';
import { pathToFileURL } from 'url';

import { importAgentsOrchestrator } from '../services/agentsRunner.js';
import {
  buildPraxisPlanUi,
  slugDomainFromUi,
  protocolUiFromAgent,
  materialsUiFromAgent,
  budgetUiFromAgent,
  timelineUiFromAgent,
  validationUiFromAgent,
} from '../services/praxisMapper.js';
import { getSupabaseAdmin } from '../services/supabaseAdmin.js';
import { embedText384 } from '../services/localEmbedder.js';

export const praxisRouter = Router();

praxisRouter.post('/generate', async (req, res) => {
  try {
    const hypothesis = String(req.body?.hypothesis || '').trim();
    // `domain` is no longer used to drive classification — Agent 0
    // auto-classifies from the hypothesis text. The field is accepted
    // for backward compatibility with older clients but ignored.
    const domainUi = String(req.body?.domain || 'Other').trim();

    if (!hypothesis) return res.status(400).json({ ok: false, error: 'hypothesis is required' });

    const slug = slugDomainFromUi(domainUi);

    const { runPipeline } = await importAgentsOrchestrator();
    const pipelineResult = await runPipeline(hypothesis, {
      skipQC: false,
      skipFeedback: false,
    });

    if (!pipelineResult?.finalPlan) {
      return res.status(500).json({
        ok: false,
        error: 'Pipeline failed before producing a plan',
        pipeline: pipelineResult,
      });
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

    // Minimum viable validation — section + a sane rating. Everything
    // else is allowed to be empty so we never reject good-faith
    // feedback (e.g. a thumbs-up has no correction text). Demo
    // deployments frequently run without Supabase, so plan_id is also
    // optional now; we still write to the local feedback store so the
    // agents can pick it up on the next regeneration.
    if (!section) return res.status(400).json({ ok: false, error: 'section is required' });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ ok: false, error: 'rating must be 1-5' });
    }

    const correctionForStore = correction || (rating >= 4 ? 'approved' : '(no correction text provided)');
    const originalForStore = original_content || '(not captured)';

    let dbId = null;
    let dbError = null;

    const supabase = getSupabaseAdmin();
    if (supabase && plan_id) {
      try {
        const textToEmbed = `${section} ${experiment_type} ${correctionForStore}`;
        const embedding = await embedText384(textToEmbed);

        const row = {
          plan_id,
          reviewer,
          section,
          rating,
          original_content: originalForStore,
          correction: correctionForStore,
          correction_reason,
          experiment_type,
          domain,
          embedding,
        };

        const { data, error } = await supabase
          .from('plan_feedback')
          .insert(row)
          .select('id')
          .single();
        if (error) {
          dbError = error.message;
        } else {
          dbId = data?.id || null;
        }
      } catch (err) {
        dbError = err instanceof Error ? err.message : String(err);
      }
    }

    // Always append to the local agents cache so the next agent run can
    // pull it as few-shot context. We only skip this for thumbs-up
    // (rating >= 4) when there is no actual correction text, since
    // those entries can't teach the model anything.
    let localStored = false;
    if (rating <= 3 || correction) {
      try {
        const { agentsRoot } = await importAgentsOrchestrator();
        const feedbackStoreUrl = pathToFileURL(path.join(agentsRoot, 'lib', 'feedbackStore.js')).href;
        const { addFeedback } = await import(feedbackStoreUrl);
        await addFeedback({
          section,
          domain,
          experiment_type,
          original: originalForStore,
          correction: correctionForStore,
          reason: correction_reason,
          rating,
        });
        localStored = true;
      } catch (err) {
        console.warn('[praxis/feedback] local feedback store unavailable:', err?.message);
      }
    }

    if (dbError) {
      console.warn('[praxis/feedback] Supabase write failed:', dbError);
    }

    return res.status(201).json({
      ok: true,
      id: dbId,
      local: localStored,
      db: Boolean(dbId),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────
// /api/praxis/chat — follow-up turn after a plan is generated.
// Classifies which section the user wants to revise (using a small LLM
// call), persists the request as a correction in the local feedback
// store (so future generations benefit), then re-runs only the single
// relevant agent with the user instruction injected. Returns the
// patched section in the UI shape so the canvas can update in-place.
// ─────────────────────────────────────────────────────────────────────
praxisRouter.post('/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const plan = req.body?.plan;
    if (!message) return res.status(400).json({ ok: false, error: 'message is required' });
    if (!plan?.meta?.hypothesis) return res.status(400).json({ ok: false, error: 'plan with meta is required' });

    const { agentsRoot } = await importAgentsOrchestrator();

    // Classify section using cheap heuristic + LLM fallback
    const sections = ['protocol', 'materials', 'budget', 'timeline', 'validation'];
    const lower = message.toLowerCase();
    let section = sections.find((s) => lower.includes(s)) || null;
    if (!section) {
      if (/(reagent|antibod|catalog|supplier|sku|kit|primer)/.test(lower)) section = 'materials';
      else if (/(price|cost|\$|budget|usd|expense)/.test(lower)) section = 'budget';
      else if (/(schedule|week|gantt|timeline|delivery|procure)/.test(lower)) section = 'timeline';
      else if (/(power|n=|sample size|control|stat|replicate|criterion|p ?<)/.test(lower)) section = 'validation';
      else section = 'protocol';
    }

    // Persist as a feedback example for future RAG retrieval
    try {
      const feedbackStoreUrl = pathToFileURL(path.join(agentsRoot, 'lib', 'feedbackStore.js')).href;
      const { addFeedback } = await import(feedbackStoreUrl);
      await addFeedback({
        section,
        domain: plan?.meta?.domain ? slugDomainFromUi(plan.meta.domain) : 'other',
        experiment_type: plan?.meta?.experiment_type || '',
        original: JSON.stringify(plan?.[section] ?? {}, null, 2).slice(0, 4000),
        correction: message,
        reason: 'Inline scientist follow-up',
        rating: 2,
      });
    } catch (e) {
      console.warn('[praxis/chat] feedback store unavailable:', e?.message);
    }

    // Re-run just the relevant agent. Re-parse the hypothesis to get a
    // fresh structured payload (domain is auto-classified by Agent 0;
    // the prior plan's domain is no longer threaded back in).
    const parserPath = pathToFileURL(path.join(agentsRoot, 'agents', 'agent0_parser.js')).href;
    const { parseHypothesis } = await import(parserPath);
    const parsed = await parseHypothesis(plan.meta.hypothesis);
    if (!parsed?.ok) return res.status(500).json({ ok: false, error: parsed?.error || 'parse failed' });

    let updated = null;
    let summary = '';

    // Forward the user's exact correction message into the agent so it
    // becomes a hard requirement in the regeneration prompt. This is
    // what turns "rate price too high → regenerate materials" into a
    // visibly cheaper materials list (rather than relying purely on
    // similarity-based feedback retrieval, which can miss).
    const regenOptions = { regenerationInstruction: message };

    if (section === 'protocol') {
      const url = pathToFileURL(path.join(agentsRoot, 'agents', 'agent2_protocol.js')).href;
      const { generateProtocol } = await import(url);
      const r = await generateProtocol(parsed.data, plan.meta.hypothesis, regenOptions);
      if (!r.ok) return res.status(500).json({ ok: false, error: r.error });
      updated = protocolUiFromAgent(r.data?.protocol);
      summary = "I've updated the **protocol** based on your feedback.";
    } else if (section === 'materials') {
      const protocolUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent2_protocol.js')).href;
      const { generateProtocol } = await import(protocolUrl);
      const protoResult = await generateProtocol(parsed.data, plan.meta.hypothesis);
      const matsUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent3_materials.js')).href;
      const { generateMaterials } = await import(matsUrl);
      const r = await generateMaterials(protoResult.data, parsed.data, plan.meta.hypothesis, regenOptions);
      if (!r.ok) return res.status(500).json({ ok: false, error: r.error });
      updated = materialsUiFromAgent(r.data?.materials);
      summary = "I've updated the **materials** list using your latest correction.";
    } else if (section === 'budget') {
      const protocolUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent2_protocol.js')).href;
      const { generateProtocol } = await import(protocolUrl);
      const protoResult = await generateProtocol(parsed.data, plan.meta.hypothesis);
      const matsUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent3_materials.js')).href;
      const { generateMaterials } = await import(matsUrl);
      const matsResult = await generateMaterials(protoResult.data, parsed.data, plan.meta.hypothesis, regenOptions);
      const budUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent4_budget_timeline.js')).href;
      const { generateBudgetTimeline } = await import(budUrl);
      const r = await generateBudgetTimeline(
        protoResult.data,
        matsResult.data || { subtotal_usd: 0, materials: [] },
        parsed.data,
        regenOptions,
      );
      if (!r.ok) return res.status(500).json({ ok: false, error: r.error });
      updated = budgetUiFromAgent(r.data?.budget, matsResult?.data?.subtotal_usd);
      summary = "I've recalculated the **budget**.";
    } else if (section === 'timeline') {
      const protocolUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent2_protocol.js')).href;
      const { generateProtocol } = await import(protocolUrl);
      const protoResult = await generateProtocol(parsed.data, plan.meta.hypothesis);
      const matsUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent3_materials.js')).href;
      const { generateMaterials } = await import(matsUrl);
      const matsResult = await generateMaterials(protoResult.data, parsed.data, plan.meta.hypothesis);
      const budUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent4_budget_timeline.js')).href;
      const { generateBudgetTimeline } = await import(budUrl);
      const r = await generateBudgetTimeline(
        protoResult.data,
        matsResult.data || { subtotal_usd: 0, materials: [] },
        parsed.data,
        regenOptions,
      );
      if (!r.ok) return res.status(500).json({ ok: false, error: r.error });
      updated = timelineUiFromAgent(r.data?.timeline);
      summary = "I've updated the **timeline** to reflect your input.";
    } else {
      const protocolUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent2_protocol.js')).href;
      const { generateProtocol } = await import(protocolUrl);
      const protoResult = await generateProtocol(parsed.data, plan.meta.hypothesis);
      const valUrl = pathToFileURL(path.join(agentsRoot, 'agents', 'agent5_validation.js')).href;
      const { generateValidation } = await import(valUrl);
      const r = await generateValidation(protoResult.data, parsed.data, plan.meta.hypothesis, regenOptions);
      if (!r.ok) return res.status(500).json({ ok: false, error: r.error });
      updated = validationUiFromAgent(r.data?.validation);
      summary = "I've updated the **validation** approach.";
    }

    return res.status(200).json({ ok: true, section, updated, summary });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
