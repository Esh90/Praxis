# Praxis — Database Layer (Supabase / Postgres 15 + pgvector)

This folder contains **only** the database layer for Praxis: SQL migrations, seed data, and optional automation scripts for applying/verifying the schema.

## Key constraints (do not change)

- **Database**: Supabase (PostgreSQL 15)
- **Vector dimension**: **384** (`Xenova/all-MiniLM-L6-v2`)
  - All vector columns are **`vector(384)`**
  - Using `vector(1536)` (old OpenAI assumption) will break inserts/retrieval.
- **Novelty signal enum**: must use **`similar_work_exists`** (not `similar_exists`)

## Folder layout

- `migrations/`: ordered migrations (`000_`, `001_`, …)
- `seeds/`: seed SQL
- `scripts/`: optional Node scripts (ESM) for running/validating
- `docs/`: schema and RAG documentation

## Setup (recommended for first-time)

1. Copy env file and fill credentials:
   - Copy `.env.example` → `.env`
   - Fill `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

2. Apply SQL migrations in **Supabase SQL Editor** (in order):
   - `migrations/000_enable_pgvector.sql`
   - `migrations/001_experiment_plans.sql`
   - `migrations/002_plan_feedback.sql`
   - `migrations/003_tavily_cache.sql`
   - `migrations/004_rls_policies.sql`
   - `migrations/005_functions.sql`
   - `migrations/006_indexes.sql`

3. Install dependencies and (optionally) seed + embed:

```bash
cd database
npm install
npm run seed
npm run embed
npm run verify
```

## Notes about the scripts

Supabase’s JS client is not primarily a raw-DDL migration tool. The scripts here assume you either:
- apply migrations manually in the SQL Editor / via Supabase CLI, or
- provide an RPC helper `exec_sql(sql_query text)` if you want full automation.

