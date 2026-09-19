'use server';

/**
 * Authentication server actions.
 *
 * These actions return error *codes*, never human text: translation stays on
 * the UI layer, and the same code renders correctly in all three languages.
 *
 * Nothing here reveals whether a given email address is registered. Sign-up
 * and password recovery always answer the same way, so the form cannot be used
 * to enumerate accounts.
 */

import { redirect } from 'next/navigation';

import { isLocale, type Locale } from '@/i18n/config';
import { getSiteUrl } from '@/lib/env';
import { ensureProfile } from '@/lib/repositories/profiles';
import { routes } from '@/lib/routes';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_invalid'
  | 'password_short'
  | 'password_mismatch'
  | 'rate_limit'
  | 'generic';

export interface AuthFormState {
  readonly status: 'idle' | 'error' | 'success';
  readonly code?: AuthErrorCode;
  /** Set when the flow finished but the visitor stays on the page. */
  readonly notice?: 'signup_success' | 'recovery_sent' | 'password_updated';
}

export const IDLE_AUTH_STATE: AuthFormState = { status: 'idle' };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;

function readLocale(formData: FormData): Locale {
  const value = formData.get('locale');
  return isLocale(value) ? value : 'lt';
}

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/** Maps a Supabase auth error to a safe code. The raw message is discarded. */
function toAuthCode(status: number | undefined, message: string): AuthErrorCode {
  if (status === 429) return 'rate_limit';
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'invalid_credentials';
  }
  return 'generic';
}

/** A safe internal redirect target: same-origin paths only. */
function safeNext(raw: FormDataEntryValue | null, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

/* -------------------------------------------------------------------------- */

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const email = readText(formData, 'email');
  const password = readText(formData, 'password');

  if (!EMAIL_PATTERN.test(email)) {
    return { status: 'error', code: 'email_invalid' };
  }

  if (password.length === 0) {
    return { status: 'error', code: 'invalid_credentials' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error !== null) {
    return { status: 'error', code: toAuthCode(error.status, error.message) };
  }

  if (data.user !== null) {
    await ensureProfile(data.user.id);
  }

  redirect(safeNext(formData.get('next'), routes.dashboard(locale)));
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const email = readText(formData, 'email');
  const password = readText(formData, 'password');
  const passwordConfirm = readText(formData, 'passwordConfirm');
  const displayName = readText(formData, 'displayName');

  if (!EMAIL_PATTERN.test(email)) {
    return { status: 'error', code: 'email_invalid' };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { status: 'error', code: 'password_short' };
  }

  if (password !== passwordConfirm) {
    return { status: 'error', code: 'password_mismatch' };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?locale=${locale}`,
      data: {
        display_name: displayName.length > 0 ? displayName : null,
        preferred_language: locale,
      },
    },
  });

  if (error !== null) {
    if (error.status === 429) return { status: 'error', code: 'rate_limit' };
    // Any other failure is reported generically so that an existing address
    // cannot be distinguished from a new one.
    return { status: 'success', notice: 'signup_success' };
  }

  return { status: 'success', notice: 'signup_success' };
}

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const email = readText(formData, 'email');

  if (!EMAIL_PATTERN.test(email)) {
    return { status: 'error', code: 'email_invalid' };
  }

  const supabase = await createSupabaseServerClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?locale=${locale}&flow=recovery`,
  });

  // Always the same answer, whether or not the address exists.
  return { status: 'success', notice: 'recovery_sent' };
}

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = readText(formData, 'password');
  const passwordConfirm = readText(formData, 'passwordConfirm');

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { status: 'error', code: 'password_short' };
  }

  if (password !== passwordConfirm) {
    return { status: 'error', code: 'password_mismatch' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error !== null) {
    return { status: 'error', code: toAuthCode(error.status, error.message) };
  }

  return { status: 'success', notice: 'password_updated' };
}

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = readLocale(formData);

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect(routes.home(locale));
}
