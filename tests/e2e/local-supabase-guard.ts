/**
 * Safety guard for the end-to-end suite.
 *
 * The suite signs in, creates listings and uploads photos. It must only ever
 * talk to a local Supabase stack, never to a hosted project, so
 * playwright.config.ts refuses to start unless the Supabase URL points at the
 * loopback interface.
 *
 * Messages never include the URL, the key or any other value: a rejected
 * value may well be a production endpoint.
 */

/** Hostnames as `URL#hostname` reports them; IPv6 keeps its brackets. */
const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

export type LocalSupabaseUrlCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'missing' | 'invalid_url' | 'not_local' };

/** Accepts only an http(s) URL whose hostname is exactly a loopback name. */
export function checkLocalSupabaseUrl(
  value: string | undefined
): LocalSupabaseUrlCheck {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0) return { ok: false, reason: 'missing' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'invalid_url' };
  }

  return LOCAL_HOSTNAMES.has(url.hostname)
    ? { ok: true }
    : { ok: false, reason: 'not_local' };
}

const REASON_TEXT: Readonly<
  Record<Exclude<LocalSupabaseUrlCheck, { ok: true }>['reason'], string>
> = {
  missing: 'NEXT_PUBLIC_SUPABASE_URL is not set in the environment.',
  invalid_url: 'NEXT_PUBLIC_SUPABASE_URL is not a valid http(s) URL.',
  not_local:
    'NEXT_PUBLIC_SUPABASE_URL does not point at localhost, 127.0.0.1 or [::1].',
};

/**
 * Checks the variables the E2E web server is built with. Returns a message
 * describing the first problem, or null when the environment is safe.
 */
export function e2eEnvironmentProblem(
  env: Readonly<Record<string, string | undefined>>
): string | null {
  const urlCheck = checkLocalSupabaseUrl(env['NEXT_PUBLIC_SUPABASE_URL']);

  if (!urlCheck.ok) {
    return (
      `E2E tests may only run against a local Supabase stack. ${REASON_TEXT[urlCheck.reason]} ` +
      'Never run them with the production .env.local. See E2E_SAFETY.md.'
    );
  }

  // Without an explicit key, `next build` would take the one from .env.local.
  if ((env['NEXT_PUBLIC_SUPABASE_ANON_KEY']?.trim() ?? '').length === 0) {
    return (
      'E2E tests may only run against a local Supabase stack. ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to the local anon key in the environment. ' +
      'See E2E_SAFETY.md.'
    );
  }

  return null;
}
