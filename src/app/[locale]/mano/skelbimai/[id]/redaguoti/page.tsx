import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ListingForm } from '@/components/listing-form/listing-form';
import { draftToFormValues } from '@/components/listing-form/form-model';
import { getDictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { fetchOwnedListingById } from '@/lib/repositories/listings';
import { routes } from '@/lib/routes';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getSessionUser();
  if (user === null) {
    redirect(`${routes.login(locale)}?next=${encodeURIComponent(routes.editListing(locale, id))}`);
  }

  const dict = getDictionary(locale);

  // Owner scoped: another user's listing is simply not found here, and RLS
  // would refuse it even if this check were bypassed.
  const result = await fetchOwnedListingById(id, user.id);
  if (!result.ok) notFound();

  const listing = result.data;

  return (
    <div className="shell max-w-3xl py-8 sm:py-10">
      <h1 className="mb-6 text-3xl">{dict.form.editTitle}</h1>
      <ListingForm
        dict={dict}
        locale={locale}
        userId={user.id}
        initial={{
          id: listing.id,
          slug: listing.slug,
          category: listing.category,
          values: draftToFormValues({
            title: listing.title,
            description: listing.description,
            condition: listing.condition,
            price: listing.price,
            quantity: listing.quantity,
            city: listing.city,
            area: listing.area,
            specs: listing.specs,
          }),
          images: listing.images.map((image) => ({
            id: image.id,
            public_url: image.public_url,
            position: image.position,
            is_primary: image.is_primary,
          })),
        }}
      />
    </div>
  );
}
