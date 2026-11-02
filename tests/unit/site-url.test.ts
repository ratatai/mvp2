import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Synthetic values only; no env file or real credential is read.
const SYNTHETIC_MALFORMED = 'not a url synthetic-marker-7f3a';

async function loadGetSiteUrl() {
  // Fresh module per test so warning deduplication state does not leak.
  vi.resetModules();
  const mod = await import('@/lib/env');
  return mod.getSiteUrl;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockRestore();
});

describe('getSiteUrl', () => {
  it('returns a valid URL unchanged', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://synthetic.example');
    const getSiteUrl = await loadGetSiteUrl();

    expect(getSiteUrl()).toBe('https://synthetic.example');
    expect(warn).not.toHaveBeenCalled();
  });

  it('strips trailing slashes and surrounding whitespace', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '  https://synthetic.example///  ');
    const getSiteUrl = await loadGetSiteUrl();

    expect(getSiteUrl()).toBe('https://synthetic.example');
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['blank', '   '],
    ['malformed', SYNTHETIC_MALFORMED],
  ])('falls back to localhost when %s', async (_label, value) => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', value);
    const getSiteUrl = await loadGetSiteUrl();

    expect(getSiteUrl()).toBe('http://localhost:3000');
  });

  it.each([
    ['missing', undefined],
    ['blank', '   '],
    ['malformed', SYNTHETIC_MALFORMED],
  ])('stays quiet outside production when %s', async (_label, value) => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', value);
    const getSiteUrl = await loadGetSiteUrl();

    getSiteUrl();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined, /missing or blank/],
    ['blank', '   ', /missing or blank/],
    ['malformed', SYNTHETIC_MALFORMED, /not a valid absolute URL/],
  ])('warns in production when %s, naming the variable and remediation', async (_label, value, reason) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', value);
    const getSiteUrl = await loadGetSiteUrl();

    expect(getSiteUrl()).toBe('http://localhost:3000');
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('NEXT_PUBLIC_SITE_URL');
    expect(message).toMatch(reason);
    expect(message).toMatch(/Set NEXT_PUBLIC_SITE_URL to the public origin/);
  });

  it('never echoes the supplied value in the warning', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SYNTHETIC_MALFORMED);
    const getSiteUrl = await loadGetSiteUrl();

    getSiteUrl();
    const output = warn.mock.calls.flat().map(String).join('\n');
    expect(output).not.toContain('synthetic-marker-7f3a');
    expect(output).not.toContain(SYNTHETIC_MALFORMED);
  });

  it('warns only once per problem across repeated calls', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', SYNTHETIC_MALFORMED);
    const getSiteUrl = await loadGetSiteUrl();

    getSiteUrl();
    getSiteUrl();
    getSiteUrl();
    expect(warn).toHaveBeenCalledTimes(1);

    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    getSiteUrl();
    getSiteUrl();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
