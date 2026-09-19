import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { RegisterForm } from '@/components/auth/auth-forms';
import { AuthShell } from '@/components/auth/auth-shell';
import { getDictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { routes } from '@/lib/routes';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  const user = await getSessionUser().catch(() => null);
  if (user !== null) redirect(routes.dashboard(locale));

  return (
    <AuthShell
      title={dict.auth.registerTitle}
      subtitle={dict.auth.registerSubtitle}
    >
      <RegisterForm dict={dict} locale={locale} />
    </AuthShell>
  );
}
