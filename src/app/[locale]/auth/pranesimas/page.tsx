import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AuthShell } from '@/components/auth/auth-shell';
import { getDictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Neutral result page for email confirmation links.
 * An expired or reused link produces a calm explanation and a way forward,
 * never a stack trace or a raw Supabase message.
 */
export default async function AuthNoticePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const { state } = await searchParams;
  const dict = getDictionary(locale);

  if (state === 'confirmed') {
    return (
      <AuthShell title={dict.auth.confirmTitle} subtitle={dict.auth.confirmSuccess}>
        <div className="space-y-2">
          <Link href={routes.dashboard(locale)} className="btn-primary w-full">
            {dict.nav.dashboard}
          </Link>
          <Link href={routes.createListing(locale)} className="btn-ghost w-full">
            {dict.nav.createListing}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={dict.auth.linkInvalidTitle}
      subtitle={dict.auth.linkInvalidText}
    >
      <div className="space-y-2">
        <Link href={routes.passwordRecovery(locale)} className="btn-primary w-full">
          {dict.auth.recoverySubmit}
        </Link>
        <Link href={routes.login(locale)} className="btn-ghost w-full">
          {dict.auth.login}
        </Link>
      </div>
    </AuthShell>
  );
}
