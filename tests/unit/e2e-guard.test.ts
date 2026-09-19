import { describe, expect, it } from 'vitest';

import {
  checkLocalSupabaseUrl,
  e2eEnvironmentProblem,
} from '../e2e/local-supabase-guard';

describe('checkLocalSupabaseUrl', () => {
  it.each([
    'http://127.0.0.1:54321',
    'http://localhost:54321',
    'http://[::1]:54321',
    'https://localhost:54321',
    'http://LOCALHOST:54321',
  ])('accepts the loopback URL %s', (value) => {
    expect(checkLocalSupabaseUrl(value)).toEqual({ ok: true });
  });

  it.each([undefined, '', '   '])('rejects a missing value (%j)', (value) => {
    expect(checkLocalSupabaseUrl(value)).toEqual({ ok: false, reason: 'missing' });
  });

  it.each(['not a url', 'localhost:54321', '127.0.0.1', 'ftp://127.0.0.1:54321'])(
    'rejects the invalid value %j',
    (value) => {
      expect(checkLocalSupabaseUrl(value)).toEqual({
        ok: false,
        reason: 'invalid_url',
      });
    }
  );

  it.each([
    'https://abcdefghijklmnopqrst.supabase.co',
    'http://localhost.example.com:54321',
    'http://127.0.0.1.example.com:54321',
    'http://localhost@example.com:54321',
    'http://192.168.1.10:54321',
    'http://0.0.0.0:54321',
  ])('rejects the non-local URL %s', (value) => {
    expect(checkLocalSupabaseUrl(value)).toEqual({ ok: false, reason: 'not_local' });
  });
});

describe('e2eEnvironmentProblem', () => {
  const LOCAL_URL = 'http://127.0.0.1:54321';
  const CLOUD_URL = 'https://abcdefghijklmnopqrst.supabase.co/rest/v1?apikey=secret-value';

  it('returns null for a local URL with a key', () => {
    expect(
      e2eEnvironmentProblem({
        NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
      })
    ).toBeNull();
  });

  it('blocks a cloud URL without echoing any part of it', () => {
    const problem = e2eEnvironmentProblem({
      NEXT_PUBLIC_SUPABASE_URL: CLOUD_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'production-anon-key',
    });

    expect(problem).toContain('only run against a local Supabase');
    expect(problem).not.toContain('supabase.co');
    expect(problem).not.toContain('abcdefghijklmnopqrst');
    expect(problem).not.toContain('secret-value');
    expect(problem).not.toContain('production-anon-key');
  });

  it('blocks a run whose URL is missing', () => {
    expect(e2eEnvironmentProblem({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' })).toContain(
      'is not set'
    );
  });

  it('blocks a local URL without an explicit key, so .env.local is never used', () => {
    const problem = e2eEnvironmentProblem({ NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL });

    expect(problem).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });
});
