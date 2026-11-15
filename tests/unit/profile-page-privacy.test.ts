import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ProfilePage from '@/app/[locale]/mano/profilis/page';

const repository = vi.hoisted(() => ({
  ensureProfile: vi.fn().mockResolvedValue(undefined),
  fetchOwnProfile: vi.fn(),
}));

vi.mock('@/lib/repositories/profiles', () => repository);
vi.mock('@/lib/supabase/server', () => ({
  getSessionUser: async () => ({ id: 'synthetic-user' }),
}));

describe('profile page phone visibility', () => {
  async function checkboxMarkup(): Promise<string> {
    const page = await ProfilePage({ params: Promise.resolve({ locale: 'lt' }) });
    const markup = renderToStaticMarkup(page);
    const checkbox = markup.match(/<input\b[^>]*\bname="phoneIsPublic"[^>]*>/)?.[0];
    expect(checkbox).toBeDefined();
    return checkbox ?? '';
  }

  it.each(['unavailable', 'not_found'])('does not render an editable form on %s', async (error) => {
    repository.fetchOwnProfile.mockResolvedValue({ ok: false, error });

    await expect(ProfilePage({ params: Promise.resolve({ locale: 'lt' }) }))
      .rejects.toThrow('Profile unavailable');
  });

  it.each([true, false])('preserves a loaded visibility preference of %s', async (phoneIsPublic) => {
    repository.fetchOwnProfile.mockResolvedValue({
      ok: true,
      data: { displayName: null, phone: null, phoneIsPublic, city: null, preferredLanguage: 'lt' },
    });

    expect(/\bchecked=""/.test(await checkboxMarkup())).toBe(phoneIsPublic);
  });
});
