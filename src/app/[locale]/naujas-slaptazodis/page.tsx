import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ResetPasswordForm } from '@/components/auth/auth-forms';
import { AuthShell } from '@/components/auth/auth-shell';
import { getDictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { routes } from '@/lib/routes';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function NewPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  // Reaching this page requires the recovery session created by the callback.
  // Without it the link has expired or was already used — a neutral state,
  // not an error.
  const user = await getSessionUser().catch(() => null);

  if (user === null) {
    return (
      <AuthShell
        title={dict.auth.linkInvalidTitle}
        subtitle={dict.auth.linkInvalidText}
      >
        <Link href={routes.passwordRecovery(locale)} className="btn-primary w-full">
          {dict.auth.recoverySubmit}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={dict.auth.resetTitle}>
      <ResetPasswordForm dict={dict} locale={locale} />
    </AuthShell>
  );
}
