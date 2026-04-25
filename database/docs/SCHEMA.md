# Praxis Database Schema

This document describes the Supabase (Postgres 15) schema for Praxis.

## Extensions

- `vector` (pgvector): enabled in `migrations/000_enable_pgvector.sql`
- `uuid-ossp`: enabled for UUID generation fallback

## Vector dimension: 384 (CRITICAL)

Praxis embeddings use **`Xenova/all-MiniLM-L6-v2`**, which produces **384-dimension** vectors.

- All vector columns are **`vector(384)`**
- All RPC functions that accept embeddings use **`vector(384)`**

If you use `vector(1536)` (old OpenAI assumption), embedding inserts/updates will fail or be rejected.

## Enum-like constraints (CRITICAL)

### `novelty_signal`

Must match agent output exactly:

- `not_found`
- `similar_work_exists`
- `exact_match_found`

## Tables

### `experiment_plans`

One row per generated experiment plan.

- **`id`**: `uuid` primary key
- **`created_at` / `updated_at`**: timestamps
- **`hypothesis`**: `text` (required)
- **`hypothesis_hash`**: `text` (SHA256 hex for dedup/cache)
- **`domain`**: `text` constrained to:
  - `diagnostics`, `gut_health`, `cell_biology`, `climate`, `other`
- **`parsed_hypothesis`**: `jsonb` (Agent 0 output)
- **`novelty_signal`**: `text` constrained values above
- **`novelty_confidence`**: `text` in `high|medium|low`
- **`literature_refs`**: `jsonb` array, default `[]`
- **`protocol`**: `jsonb`
- **`materials`**: `jsonb` array, default `[]`
- **`materials_subtotal`**: `numeric(10,2)`
- **`materials_disclaimer`**: `text`
- **`budget`**: `jsonb`
- **`timeline`**: `jsonb`
- **`validation`**: `jsonb`
- **`embedding`**: `vector(384)` (for similarity search)
- **`status`**: `text` in `generating|complete|failed`
- **`pipeline_warnings`**: `jsonb` array
- **`generation_ms`**: `integer`
- **`user_id`**: nullable `uuid` (future auth)

#### Trigger: `updated_at`

`update_updated_at_column()` + trigger `experiment_plans_updated_at` updates `updated_at` on update.

### `plan_feedback`

Scientist corrections to plan sections. Powers the feedback RAG loop.

- **`id`**: `uuid` primary key
- **`created_at`**: timestamp
- **`plan_id`**: `uuid` FK → `experiment_plans(id)` with **`ON DELETE CASCADE`**
- **`reviewer`**: `text`
- **`section`**: `text` in `protocol|materials|budget|timeline|validation`
- **`rating`**: `smallint` \(1..5\)
- **`original_content`**: `text`
- **`correction`**: `text`
- **`correction_reason`**: `text`
- **`experiment_type`**: `text`
- **`domain`**: same domain constraint as plans
- **`embedding`**: `vector(384)` (RAG retrieval)
- **`applied_count`**: `integer` default `0`

### `tavily_cache`

Persistent cache of literature QC results (TTL 7 days).

- **`id`**: `uuid` primary key
- **`created_at`**: timestamp
- **`hypothesis_hash`**: `text` unique
- **`results`**: `jsonb` default `[]`
- **`novelty_signal`**: constrained novelty values
- **`classified_result`**: `jsonb`
- **`expires_at`**: timestamp default now + 7 days

## RLS policies (hackathon defaults)

Defined in `migrations/004_rls_policies.sql`:

- `experiment_plans`: public `SELECT`
- `plan_feedback`: public `SELECT` + anon `INSERT`
- `tavily_cache`: public `SELECT` of only non-expired rows

Backend writes should use the **service role key** (bypasses RLS).

## RPC functions

Defined in `migrations/005_functions.sql`:

- **`get_relevant_feedback(query_embedding vector(384), filter_domain text, filter_section text, max_results int)`**
  - Returns top N corrections by cosine similarity
  - Filters by `section`, `domain`, and `rating <= 3` before vector search
- **`increment_feedback_applied(feedback_id uuid)`**
  - Increments `applied_count`
- **`find_similar_plans(query_embedding vector(384), similarity_threshold float, max_results int)`**
  - Returns similar plans by cosine similarity
- **`get_tavily_cache(p_hash text)`**
  - Returns cached `classified_result` if present and not expired
- **`set_tavily_cache(p_hash text, p_results jsonb, p_novelty_signal text, p_classified_result jsonb)`**
  - Upserts cache rows and refreshes expiry
- **`get_dashboard_stats()`**
  - Returns JSON summary stats for admin/demo dashboards

## Index strategy

Defined in `migrations/006_indexes.sql`:

- B-tree indexes for common filters (`domain`, `status`, `created_at`, `rating`, etc.)
- `ivfflat` vector indexes using `vector_cosine_ops` with `lists = 10` (hackathon scale)

