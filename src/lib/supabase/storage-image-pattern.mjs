/**
 * next/image remote pattern for Supabase Storage public objects.
 *
 * Protocol, hostname and port all come from NEXT_PUBLIC_SUPABASE_URL:
 *   • a hosted project stays https-only, on its default port;
 *   • a local stack such as http://127.0.0.1:54321 is allowed on exactly that
 *     host and port, so photos render during local E2E runs.
 *
 * Plain http is accepted only for a loopback host. An http URL pointing
 * anywhere else is a misconfiguration and produces no pattern at all.
 *
 * Plain JavaScript because next.config.mjs imports it; the types live in
 * storage-image-pattern.d.mts.
 */

export const STORAGE_PUBLIC_PATHNAME = '/storage/v1/object/public/**';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);

export function supabaseStorageImagePattern(supabaseUrl) {
  const raw = typeof supabaseUrl === 'string' ? supabaseUrl.trim() : '';
  if (raw.length === 0) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    // An invalid URL is reported by the runtime env validation in src/lib/env.ts.
    return null;
  }

  const protocol = url.protocol.replace(/:$/, '');
  const allowed =
    protocol === 'https' ||
    (protocol === 'http' && LOOPBACK_HOSTS.has(url.hostname));
  if (!allowed) return null;

  return {
    protocol,
    hostname: url.hostname,
    // Always explicit. next/image treats an omitted port as "any port on this
    // host"; an empty string means the scheme's default port only.
    port: url.port,
    pathname: STORAGE_PUBLIC_PATHNAME,
  };
}
