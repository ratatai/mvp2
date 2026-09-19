import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/auth-forms';
import { AuthShell } from '@/components/auth/auth-shell';
import { getDictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { routes } from '@/lib/routes';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { next } = await searchParams;
  const dict = getDictionary(locale);

  // Already signed in: go straight to the dashboard.
  const user = await getSessionUser().catch(() => null);
  if (user !== null) redirect(routes.dashboard(locale));

  return (
    <AuthShell title={dict.auth.loginTitle} subtitle={dict.auth.loginSubtitle}>
      <LoginForm dict={dict} locale={locale} next={next} />
    </AuthShell>
  );
}
