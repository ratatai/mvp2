'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from '@/app/actions/auth';
import {
  IDLE_AUTH_STATE,
  type AuthErrorCode,
  type AuthFormState,
} from '@/app/actions/auth-state';
import type { Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { routes } from '@/lib/routes';

function errorMessage(code: AuthErrorCode | undefined, dict: Dictionary): string {
  switch (code) {
    case 'invalid_credentials':
      return dict.auth.errorInvalidCredentials;
    case 'email_invalid':
      return dict.auth.errorEmailInvalid;
    case 'password_short':
      return dict.auth.errorPasswordShort;
    case 'password_mismatch':
      return dict.auth.errorPasswordMismatch;
    case 'rate_limit':
      return dict.auth.errorRateLimit;
    default:
      return dict.auth.errorGeneric;
  }
}

function noticeMessage(
  notice: AuthFormState['notice'],
  dict: Dictionary
): string | null {
  switch (notice) {
    case 'signup_success':
      return dict.auth.signupSuccess;
    case 'recovery_sent':
      return dict.auth.recoverySent;
    case 'password_updated':
      return dict.auth.resetDone;
    default:
      return null;
  }
}

/** Disables itself while the action runs, which also blocks double submits. */
function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function FormMessage({ state, dict }: { state: AuthFormState; dict: Dictionary }) {
  if (state.status === 'error') {
    return (
      <p role="alert" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm text-ink">
        {errorMessage(state.code, dict)}
      </p>
    );
  }

  const notice = noticeMessage(state.notice, dict);
  if (notice === null) return null;

  return (
    <p role="status" className="rounded-xl border border-success/40 bg-success/10 p-3 text-sm text-ink">
      {notice}
    </p>
  );
}

/* -------------------------------------------------------------------------- */

export function LoginForm({
  dict,
  locale,
  next,
}: {
  dict: Dictionary;
  locale: Locale;
  next?: string;
}) {
  const [state, action] = useActionState(signInAction, IDLE_AUTH_STATE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {next !== undefined && <input type="hidden" name="next" value={next} />}

      <FormMessage state={state} dict={dict} />

      <label className="block">
        <span className="field-label">{dict.auth.email}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="field"
        />
      </label>

      <label className="block">
        <span className="field-label">{dict.auth.password}</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </label>

      <SubmitButton label={dict.auth.login} pendingLabel={dict.common.loading} />

      <div className="flex flex-wrap justify-between gap-2 text-sm text-ink-muted">
        <Link href={routes.passwordRecovery(locale)} className="hover:text-ink">
          {dict.auth.forgotPassword}
        </Link>
        <span>
          {dict.auth.noAccount}{' '}
          <Link href={routes.register(locale)} className="text-brand hover:underline">
            {dict.auth.register}
          </Link>
        </span>
      </div>
    </form>
  );
}

export function RegisterForm({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const [state, action] = useActionState(signUpAction, IDLE_AUTH_STATE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <FormMessage state={state} dict={dict} />

      <label className="block">
        <span className="field-label">
          {dict.auth.displayName}{' '}
          <span className="text-ink-faint">({dict.common.optional})</span>
        </span>
        <input
          type="text"
          name="displayName"
          autoComplete="name"
          className="field"
        />
      </label>

      <label className="block">
        <span className="field-label">{dict.auth.email}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="field"
        />
      </label>

      <label className="block">
        <span className="field-label">{dict.auth.password}</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="field"
        />
        <span className="mt-1 block text-xs text-ink-faint">
          {dict.auth.errorPasswordShort}
        </span>
      </label>

      <label className="block">
        <span className="field-label">{dict.auth.passwordConfirm}</span>
        <input
          type="password"
          name="passwordConfirm"
          autoComplete="new-password"
          minLength={8}
          required
          className="field"
        />
      </label>

      <SubmitButton label={dict.auth.register} pendingLabel={dict.common.loading} />

      <p className="text-center text-sm text-ink-muted">
        {dict.auth.hasAccount}{' '}
        <Link href={routes.login(locale)} className="text-brand hover:underline">
          {dict.auth.login}
        </Link>
      </p>
    </form>
  );
}

export function RecoveryForm({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const [state, action] = useActionState(
    requestPasswordResetAction,
    IDLE_AUTH_STATE
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <FormMessage state={state} dict={dict} />

      <label className="block">
        <span className="field-label">{dict.auth.email}</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="field"
        />
      </label>

      <SubmitButton
        label={dict.auth.recoverySubmit}
        pendingLabel={dict.common.loading}
      />

      <p className="text-center text-sm text-ink-muted">
        <Link href={routes.login(locale)} className="hover:text-ink">
          {dict.auth.login}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const [state, action] = useActionState(updatePasswordAction, IDLE_AUTH_STATE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <FormMessage state={state} dict={dict} />

      <label className="block">
        <span className="field-label">{dict.auth.password}</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="field"
        />
      </label>

      <label className="block">
        <span className="field-label">{dict.auth.passwordConfirm}</span>
        <input
          type="password"
          name="passwordConfirm"
          autoComplete="new-password"
          minLength={8}
          required
          className="field"
        />
      </label>

      <SubmitButton
        label={dict.auth.resetSubmit}
        pendingLabel={dict.common.loading}
      />

      {state.notice === 'password_updated' && (
        <Link href={routes.login(locale)} className="btn-ghost w-full">
          {dict.auth.login}
        </Link>
      )}
    </form>
  );
}
