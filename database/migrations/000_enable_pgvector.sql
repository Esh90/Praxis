-- ============================================================
-- Migration 000: Enable pgvector extension
-- MUST run before any table with vector columns is created.
-- Run this in Supabase SQL editor if not using the setup script.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- for gen_random_uuid() fallback

-- Verify it loaded
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    RAISE EXCEPTION 'pgvector extension failed to load. Contact Supabase support.';
  END IF;
  RAISE NOTICE 'pgvector extension: OK';
END $$;

