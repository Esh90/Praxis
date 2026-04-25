import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin({ url, serviceRoleKey }) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

