'use server';

import { revalidatePath } from 'next/cache';

import type { ProfileFormState } from '@/app/actions/profile-state';
import { isLocale, type Locale } from '@/i18n/config';
import { updateOwnProfile } from '@/lib/repositories/profiles';
import { getSessionUser } from '@/lib/supabase/server';

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const user = await getSessionUser();
  if (user === null) return { status: 'error' };

  const rawLocale = formData.get('preferredLanguage');
  const preferredLanguage: Locale = isLocale(rawLocale) ? rawLocale : 'lt';

  const result = await updateOwnProfile(user.id, {
    displayName: text(formData, 'displayName'),
    phone: text(formData, 'phone'),
    phoneIsPublic: formData.get('phoneIsPublic') === 'on',
    city: text(formData, 'city'),
    preferredLanguage,
  });

  if (!result.ok) return { status: 'error' };

  revalidatePath('/[locale]/mano/profilis', 'page');

  return { status: 'saved' };
}
