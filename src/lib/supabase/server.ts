import 'server-only';

/**
 * Server Supabase client for Server Components, Route Handlers and Server
 * Actions.
 *
 * Still the anon key — this application has no service_role path at all. The
 * session is carried by cookies that the middleware keeps fresh.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getPublicEnv } from '@/lib/env';
import type { Database } from './database.types';

export async function createSupabaseServerClient() {
  // Read cookies before env: this marks the route as dynamic, so `next build`
  // does not try to prerender per-user pages (and fail on missing env).
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot mutate cookies. This is expected and
          // harmless: the middleware already refreshed the session cookie for
          // this request.
        }
      },
    },
  });
}

/** Returns the signed-in user, or null. Never throws. */
export async function getSessionUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error !== null || data.user === null) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}
