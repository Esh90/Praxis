# Praxis Agents (Challenge 04 — The AI Scientist)

This folder contains the complete **agent pipeline** that turns a natural-language scientific hypothesis into a **runnable experiment plan**:

1. **Input parsing** (Agent 0)
2. **Literature QC / novelty signal** (Agent 1, via Tavily)
3. **Experiment plan generation** (Agents 2–5)
   - Protocol
   - Materials + supply chain
   - Budget + timeline
   - Validation approach

Built for the hackathon challenge in collaboration with the **MIT Club of Northern California** and **MIT Club of Germany**.

## Setup

### 1) Install Node.js

- Node.js **>= 20** recommended.

### 2) Configure environment variables

Copy `.env.example` to `.env` and fill in keys:

- `GROQ_API_KEY`: get a free key from `console.groq.com`
- `TAVILY_API_KEY`: get a free key from `app.tavily.com`
- `GEMINI_API_KEY` (optional fallback): get from `aistudio.google.com`

### 3) Install dependencies

From `Praxis/agents/`:

```bash
npm install
```

## Running tests

Each stage has a test script:

```bash
npm run test:parser
npm run test:qc
npm run test:protocol
npm run test:materials
npm run test:budget
npm run test:validation
```

Run the full pipeline:

```bash
npm run test:full
```

## Running the pipeline directly

```bash
node orchestrator.js --run
```

Or with a custom hypothesis:

```bash
node orchestrator.js --run "My hypothesis text here..."
```

## Feedback loop (stretch goal)

The feedback store is implemented in `lib/feedbackStore.js` and works locally without Supabase:

- **`addFeedback(feedback)`**: stores a scientist correction and embeds it locally
- **`getRelevantFeedback(hypothesis, domain, section)`**: retrieves similar past corrections
- **`buildFewShotBlock(corrections)`**: converts corrections into a few-shot prompt block

Embeddings are generated locally (free) using `@xenova/transformers` with `Xenova/all-MiniLM-L6-v2`.

## File structure

```
agents/
├── .env.example
├── .env
├── package.json
├── README.md
├── cache/
│   └── .gitkeep
├── data/
│   └── reagent_catalog.json
├── lib/
│   ├── groqClient.js
│   ├── tavilyClient.js
│   ├── embedder.js
│   ├── cacheManager.js
│   ├── jsonSafeParse.js
│   └── feedbackStore.js
├── agents/
│   ├── agent0_parser.js
│   ├── agent1_qc.js
│   ├── agent2_protocol.js
│   ├── agent3_materials.js
│   ├── agent4_budget_timeline.js
│   └── agent5_validation.js
├── orchestrator.js
└── tests/
    ├── test_agent0.js
    ├── test_agent1.js
    ├── test_agent2.js
    ├── test_agent3.js
    ├── test_agent4.js
    ├── test_agent5.js
    └── test_full_pipeline.js
```

## Free API keys

- Groq: `console.groq.com`
- Tavily: `app.tavily.com`
- Gemini (optional fallback): `aistudio.google.com`

