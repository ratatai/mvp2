import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression coverage for the build fix: cookies() must be awaited before env
// is read, so `next build` treats per-user pages as dynamic instead of
// prerendering them (and failing when Supabase env is absent).

const events: string[] = [];

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => {
    events.push('cookies:called');
    await Promise.resolve();
    events.push('cookies:resolved');
    return { getAll: () => [], set: () => undefined };
  }),
}));

vi.mock('@/lib/env', () => ({
  getPublicEnv: vi.fn(() => {
    events.push('getPublicEnv');
    return { supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: 'test-anon-key' };
  }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => {
    events.push('createServerClient');
    return {};
  }),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';

describe('createSupabaseServerClient', () => {
  beforeEach(() => {
    events.length = 0;
  });

  it('awaits cookies() before reading env and before creating the client', async () => {
    await createSupabaseServerClient();

    expect(events).toEqual([
      'cookies:called',
      'cookies:resolved',
      'getPublicEnv',
      'createServerClient',
    ]);
  });
});
