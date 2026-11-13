import { describe, expect, it } from 'vitest';
import { validateHeaderValue } from 'node:http';

import { safeAuthNext } from '@/lib/auth-redirect';

const fallback = '/lt/mano';

describe('post-login redirect', () => {
  it.each([
    '/lt/naujas-skelbimas',
    '/ru/mano',
    '/en/mano/skelbimai?status=draft#list',
    '/lt/skelbimai?q=205%2F55%20R16',
    '/%2F%2Fexample.invalid',
    '/%5Cexample.invalid',
    '/@example.invalid',
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
    '/%2e%2e//example.invalid', '/lt/%2e%2e/%2e%2e//example.invalid',
    '/.//example.invalid',
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

  it('serializes Lithuanian text into a valid HTTP redirect header', () => {
    const path = '/lt/ąžuolas?q=žieminės#rūšis';
    expect(() => validateHeaderValue('Location', path)).toThrow();
    const result = safeAuthNext(path, fallback);
    expect(result).toBe('/lt/%C4%85%C5%BEuolas?q=%C5%BEiemin%C4%97s#r%C5%AB%C5%A1is');
    expect(() => validateHeaderValue('Location', result)).not.toThrow();
    expect(new URL(result, 'https://ratatai.example').origin)
      .toBe('https://ratatai.example');
  });

  it('keeps a fullwidth separator on the local origin', () => {
    const result = safeAuthNext('/＼example.invalid', fallback);
    expect(result).toBe('/%EF%BC%BCexample.invalid');
    expect(new URL(result, 'https://ratatai.example').origin)
      .toBe('https://ratatai.example');
  });
});
