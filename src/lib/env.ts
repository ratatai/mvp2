/**
 * Environment validation.
 *
 * Only public variables exist in this application: there is no service_role
 * key anywhere in the codebase, and none of these values is ever written to a
 * log or to a report.
 */

const PLACEHOLDERS = new Set([
  'your-anon-key-here',
  'your-project.supabase.co',
  'https://your-project.supabase.co',
  'https://your-project-ref.supabase.co',
]);

export interface PublicEnv {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly siteUrl: string;
}

function readVar(name: string, value: string | undefined): string {
  const trimmed = value?.trim() ?? '';

  if (trimmed.length === 0) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`
    );
  }

  if (PLACEHOLDERS.has(trimmed)) {
    throw new Error(
      `Environment variable ${name} still holds the example placeholder value.`
    );
  }

  return trimmed;
}

let cached: PublicEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (cached !== null) return cached;

  const supabaseUrl = readVar(
    'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const supabaseAnonKey = readVar(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // Throws for a malformed URL, which is much easier to debug here than in
    // the middle of a Supabase request.
    void new URL(supabaseUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.');
  }

  if (supabaseAnonKey.startsWith('sb_secret') || supabaseAnonKey.includes('service_role')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a secret key. Only the public anon/publishable key may be used here.'
    );
  }

  cached = { supabaseUrl, supabaseAnonKey, siteUrl: getSiteUrl() };
  return cached;
}

const FALLBACK_SITE_URL = 'http://localhost:3000';

/**
 * Absolute site origin, safe to call during static generation.
 * A variable that is present but blank counts as missing, otherwise
 * `new URL('')` would throw while building page metadata.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? '';
  if (raw.length === 0) return FALLBACK_SITE_URL;

  const withoutTrailingSlash = raw.replace(/\/+$/, '');

  try {
    void new URL(withoutTrailingSlash);
  } catch {
    return FALLBACK_SITE_URL;
  }

  return withoutTrailingSlash;
}
