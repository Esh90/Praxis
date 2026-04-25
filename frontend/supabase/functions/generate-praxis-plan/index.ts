// Praxis: generate experiment plan (mock JSON shell).
// Replace handler internals with real agentic orchestration in Cursor.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  hypothesis: string;
  domain: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { hypothesis, domain } = (await req.json()) as Payload;

    // Simulate agentic latency
    await new Promise((r) => setTimeout(r, 800));

    const response = {
      novelty: {
        status: "Similar Exists",
        references: [
          { title: "Microbiome diversity correlates with metabolic markers", authors: "Chen et al.", year: 2023, doi: "10.1038/s41586-023-12345" },
          { title: "Gut-brain axis modulation via short-chain fatty acids", authors: "Patel & Kumar", year: 2022, doi: "10.1126/science.abc9876" },
        ],
      },
      protocol: [
        { step: 1, title: "Sample Collection", description: "Collect fecal samples from 24 subjects under fasted conditions, store at -80°C within 2h.", duration_min: 120 },
        { step: 2, title: "DNA Extraction", description: "Use QIAamp PowerFecal Pro DNA Kit per manufacturer protocol; verify yield via Qubit dsDNA HS.", duration_min: 240 },
        { step: 3, title: "16S rRNA Amplification", description: "Amplify V3-V4 region with 341F/805R primers; 25 cycles, annealing at 55°C.", duration_min: 180 },
        { step: 4, title: "Library Prep & Sequencing", description: "Nextera XT indexing, pool to 4nM, sequence on Illumina MiSeq 2x300bp.", duration_min: 1440 },
        { step: 5, title: "Bioinformatic Analysis", description: "QIIME2 pipeline: DADA2 denoising, SILVA 138 taxonomy, alpha/beta diversity metrics.", duration_min: 480 },
      ],
      materials: [
        { name: "QIAamp PowerFecal Pro DNA Kit", category: "Reagent", supplier: "Qiagen", catalog: "51804", cost: 612.0, quantity: 1, unit: "kit" },
        { name: "Qubit dsDNA HS Assay Kit", category: "Reagent", supplier: "Thermo Fisher", catalog: "Q32854", cost: 198.0, quantity: 1, unit: "kit" },
        { name: "341F/805R Primer Set", category: "Oligo", supplier: "IDT", catalog: "Custom-16S-V3V4", cost: 145.0, quantity: 2, unit: "tube" },
        { name: "Nextera XT Index Kit v2", category: "Reagent", supplier: "Illumina", catalog: "FC-131-2001", cost: 920.0, quantity: 1, unit: "kit" },
        { name: "MiSeq Reagent Kit v3 (600-cycle)", category: "Sequencing", supplier: "Illumina", catalog: "MS-102-3003", cost: 1685.0, quantity: 1, unit: "kit" },
        { name: "Phusion High-Fidelity Polymerase", category: "Enzyme", supplier: "NEB", catalog: "M0530S", cost: 124.0, quantity: 1, unit: "vial" },
        { name: "AMPure XP Beads (5mL)", category: "Cleanup", supplier: "Beckman Coulter", catalog: "A63880", cost: 295.0, quantity: 1, unit: "bottle" },
      ],
      budget: {
        labor: 4800,
        materials: 3979,
        contingency: 880,
        grand_total: 9659,
        currency: "USD",
        breakdown_notes: "Labor: 60h @ $80/h. Contingency: 10% of subtotal.",
      },
      timeline: [
        { phase: "Recruitment & Sample Collection", weeks: 2, start_week: 1 },
        { phase: "DNA Extraction & QC", weeks: 1, start_week: 3 },
        { phase: "Library Prep", weeks: 1, start_week: 4 },
        { phase: "Sequencing", weeks: 1, start_week: 5 },
        { phase: "Bioinformatic Analysis", weeks: 2, start_week: 6 },
        { phase: "Reporting", weeks: 1, start_week: 8 },
      ],
      validation: {
        statistical_power: 0.82,
        sample_size_justification: "n=24 provides 82% power to detect Cohen's d=0.6 at α=0.05.",
        controls: ["Negative extraction control", "Mock community (ZymoBIOMICS)", "Sequencing blanks"],
        risks: [
          { risk: "Low DNA yield from low-biomass samples", mitigation: "Use carrier RNA; pool replicates if <10ng" },
          { risk: "Batch effects across sequencing runs", mitigation: "Randomize sample placement; include bridge samples" },
        ],
      },
      meta: { hypothesis, domain, generated_at: new Date().toISOString() },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
