import 'server-only';

/**
 * Profile data access. Strictly owner scoped: there is no function here that
 * can read another user's profile, and the email address is never touched —
 * it stays in auth.users.
 */

import type { Locale } from '@/i18n/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { RepoResult } from './listings';

export interface OwnProfile {
  readonly displayName: string | null;
  readonly phone: string | null;
  readonly phoneIsPublic: boolean;
  readonly city: string | null;
  readonly preferredLanguage: Locale;
}

export interface ProfileUpdate {
  readonly displayName: string | null;
  readonly phone: string | null;
  readonly phoneIsPublic: boolean;
  readonly city: string | null;
  readonly preferredLanguage: Locale;
}

function toLocale(value: string): Locale {
  return value === 'ru' || value === 'en' ? value : 'lt';
}

export async function fetchOwnProfile(
  userId: string
): Promise<RepoResult<OwnProfile>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, phone, phone_is_public, city, preferred_language')
    .eq('id', userId)
    .maybeSingle();

  if (error !== null) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[profiles:fetchOwnProfile]', error);
    }
    return { ok: false, error: 'unavailable' };
  }

  if (data === null) return { ok: false, error: 'not_found' };

  return {
    ok: true,
    data: {
      displayName: data.display_name,
      phone: data.phone,
      phoneIsPublic: data.phone_is_public,
      city: data.city,
      preferredLanguage: toLocale(data.preferred_language),
    },
  };
}

export async function updateOwnProfile(
  userId: string,
  update: ProfileUpdate
): Promise<RepoResult<null>> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: update.displayName,
      phone: update.phone,
      phone_is_public: update.phoneIsPublic,
      city: update.city,
      preferred_language: update.preferredLanguage,
    })
    .eq('id', userId);

  if (error !== null) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[profiles:updateOwnProfile]', error);
    }
    return { ok: false, error: 'unavailable' };
  }

  return { ok: true, data: null };
}

/**
 * Makes sure a profile row exists. The database trigger creates it on sign-up,
 * but a project restored from a backup, or a user created before the trigger
 * existed, would otherwise be unable to publish.
 */
export async function ensureProfile(userId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (data !== null) return;

  await supabase.from('profiles').insert({ id: userId });
}
