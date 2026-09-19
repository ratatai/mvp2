import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ListingForm } from '@/components/listing-form/listing-form';
import { getDictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { ensureProfile } from '@/lib/repositories/profiles';
import { routes } from '@/lib/routes';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CreateListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getSessionUser();
  if (user === null) {
    redirect(`${routes.login(locale)}?next=${encodeURIComponent(routes.createListing(locale))}`);
  }

  // A listing references profiles(id), so the row has to be there.
  await ensureProfile(user.id);

  const dict = getDictionary(locale);

  return (
    <div className="shell max-w-3xl py-8 sm:py-10">
      <h1 className="mb-6 text-3xl">{dict.form.createTitle}</h1>
      <ListingForm dict={dict} locale={locale} userId={user.id} />
    </div>
  );
}
