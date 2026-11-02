/**
 * Guard for the seller lifecycle spec's account.
 *
 * The lifecycle spec signs in and writes listings, so the account it uses
 * must be a synthetic user created in the local stack. Only addresses on the
 * reserved `example.test` or `example.invalid` domains (RFC 2606/6761) are
 * accepted; anything else is refused before the browser ever signs in.
 *
 * Messages never include the address: a rejected value may be a real person's.
 */

const SYNTHETIC_DOMAINS: ReadonlySet<string> = new Set([
  'example.test',
  'example.invalid',
]);

/** True only for `local@example.test` or `local@example.invalid`. */
export function isSyntheticE2eEmail(value: string | undefined): boolean {
  const trimmed = value?.trim().toLowerCase() ?? '';
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || trimmed.indexOf('@') !== at) return false;

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (/\s/.test(local)) return false;

  return SYNTHETIC_DOMAINS.has(domain);
}

export const NON_SYNTHETIC_EMAIL_MESSAGE =
  'E2E_EMAIL must be a synthetic local account on example.test or example.invalid; refusing to sign in.';
