import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ProfileForm } from '@/components/dashboard/profile-form';
import { getDictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { ensureProfile, fetchOwnProfile } from '@/lib/repositories/profiles';
import { routes } from '@/lib/routes';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getSessionUser();
  if (user === null) {
    redirect(
      `${routes.login(locale)}?next=${encodeURIComponent(routes.profile(locale))}`
    );
  }

  await ensureProfile(user.id);

  const dict = getDictionary(locale);
  const result = await fetchOwnProfile(user.id);

  const profile = result.ok
    ? result.data
    : {
        displayName: null,
        phone: null,
        phoneIsPublic: true,
        city: null,
        preferredLanguage: locale,
      };

  return (
    <div className="shell max-w-xl py-8 sm:py-10">
      <h1 className="text-3xl">{dict.profile.title}</h1>
      <p className="mb-6 mt-2 text-sm text-ink-muted">{dict.profile.subtitle}</p>
      <div className="card p-6">
        <ProfileForm profile={profile} dict={dict} />
      </div>
    </div>
  );
}
