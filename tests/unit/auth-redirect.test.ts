import { describe, expect, it } from 'vitest';

import { safeAuthNext } from '@/lib/auth-redirect';

const fallback = '/lt/mano';

describe('post-login redirect', () => {
  it.each([
    '/lt/naujas-skelbimas',
    '/ru/mano',
    '/en/mano/skelbimai?status=draft#list',
    '/lt/skelbimai?q=205%2F55%20R16',
    '/',
  ])('preserves the local path %s', (path) => {
    expect(safeAuthNext(path, fallback)).toBe(path);
    expect(new URL(safeAuthNext(path, fallback), 'https://ratatai.example').origin)
      .toBe('https://ratatai.example');
  });

  it.each([
    null, undefined, {}, '', 'https://example.invalid', '//example.invalid',
    '/\\example.invalid', '/\t/example.invalid', '/\n/example.invalid',
    '/\r/example.invalid', '/lt/\u0000mano', '/lt/\u007fmano',
    '/lt/..//example.invalid', 'javascript:alert(1)', 'lt/mano',
  ])('rejects unsafe or invalid destination %#', (value) => {
    expect(safeAuthNext(value, fallback)).toBe(fallback);
  });

  it('rejects a backslash URL that the old slash-only guard accepted', () => {
    const attack = '/\\example.invalid';
    expect(attack.startsWith('/') && !attack.startsWith('//')).toBe(true);
    expect(new URL(attack, 'https://ratatai.example').origin)
      .toBe('https://example.invalid');
    expect(safeAuthNext(attack, fallback)).toBe(fallback);
  });
});
