import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { RecoveryForm } from '@/components/auth/auth-forms';
import { AuthShell } from '@/components/auth/auth-shell';
import { getDictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PasswordRecoveryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  return (
    <AuthShell
      title={dict.auth.recoveryTitle}
      subtitle={dict.auth.recoverySubtitle}
    >
      <RecoveryForm dict={dict} locale={locale} />
    </AuthShell>
  );
}
