'use client';

/**
 * Browser Supabase client.
 *
 * Uses the public anon key only. Every read and write from the browser is
 * additionally constrained by the RLS policies in 002_security_hardening.sql,
 * so a tampered client cannot reach another user's data.
 */

import { createBrowserClient } from '@supabase/ssr';

import { getPublicEnv } from '@/lib/env';
import type { Database } from './database.types';

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
