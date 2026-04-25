# Praxis RAG Feedback Retrieval

Praxis improves future plans by retrieving **past scientist corrections** that are most relevant to the current hypothesis and plan section. This is the feedback “flywheel”.

## End-to-end flow

1. **Feedback submitted**
   - A scientist submits a correction to a specific plan section (`protocol`, `materials`, `budget`, `timeline`, `validation`).
   - Stored as one row in `plan_feedback`.

2. **Feedback embedded (384 dims)**
   - We embed a text representation of the correction using:
     - Model: `Xenova/all-MiniLM-L6-v2`
     - Output: **384-dimension** vector
   - Store into `plan_feedback.embedding` (`vector(384)`).

3. **Retrieval at generation time**
   - When generating a new plan section, the backend/agents:
     - embeds the current hypothesis/context into a **384-dim** vector
     - calls the RPC `get_relevant_feedback(...)`

4. **Few-shot injection**
   - Retrieved corrections are formatted as few-shot examples and injected into the agent prompt for that section.

5. **Applied count tracking**
   - When a correction is actually injected, the backend can call:
     - `increment_feedback_applied(feedback_id)`
   - This increments `applied_count`, letting you observe which feedback is most valuable.

## Why we filter before similarity search

`get_relevant_feedback` applies cheap filters first:

- **`section` must match** the section being generated
- **`domain` must match** (or domain filter is `other`)
- **`rating <= 3` only**
  - We only want corrections where the AI was materially wrong

Then we do the vector search on the reduced set. This is faster and improves relevance.

## How `get_relevant_feedback` ranks results

We use cosine distance operator `<=>` from pgvector.

- `<=>` returns **cosine distance** (smaller is closer)
- We convert to similarity:
  - \( similarity = 1 - distance \)

