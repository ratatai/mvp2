/**
 * Form state shared by the profile server action and its form.
 *
 * Kept out of profile.ts because a 'use server' module may only export async
 * functions.
 */

export interface ProfileFormState {
  readonly status: 'idle' | 'saved' | 'error';
}

export const IDLE_PROFILE_STATE: ProfileFormState = { status: 'idle' };
