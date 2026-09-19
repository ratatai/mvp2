/**
 * Form state shared by the authentication server actions and their forms.
 *
 * Kept out of auth.ts because a 'use server' module may only export async
 * functions.
 */

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
