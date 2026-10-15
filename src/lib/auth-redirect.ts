/** Accept only local paths for the post-login redirect. */
export function safeAuthNext(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return fallback;
  }

  // Browsers interpret backslashes as slashes in HTTP URLs and strip some
  // control characters. Reject them before checking the destination.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;

  const origin = 'https://redirect.invalid';
  try {
    const destination = new URL(raw, origin);
    if (destination.origin !== origin || destination.pathname.startsWith('//')) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return raw;
}
