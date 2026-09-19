import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Gallery } from '@/components/listing/gallery';
import { SellerContact } from '@/components/listing/seller-contact';
import { ArrowLeftIcon } from '@/components/ui/icons';
import { primaryImageOf } from '@/domain/listing.mapper';
import { getDictionary } from '@/i18n';
import { LOCALES, isLocale } from '@/i18n/config';
import { getSiteUrl } from '@/lib/env';
import { formatDate, formatPrice } from '@/lib/format';
import { fetchListingBySlug } from '@/lib/repositories/listings';
import { routes } from '@/lib/routes';
import { listingSpecGroups } from '@/lib/spec-display';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const result = await fetchListingBySlug(slug);
  if (!result.ok) {
    const dict = getDictionary(locale);
    return { title: dict.listing.notFoundTitle, robots: { index: false } };
  }

  const { listing } = result.data;
  const dict = getDictionary(locale);
  const image = primaryImageOf(listing.images);

  const description = listing.description.slice(0, 160);

  return {
    title: listing.title,
    description,
    alternates: {
      canonical: `/${locale}/skelbimas/${slug}`,
      languages: Object.fromEntries(
        LOCALES.map((item) => [item, `/${item}/skelbimas/${slug}`])
      ),
    },
    openGraph: {
      type: 'website',
      title: `${listing.title} — ${dict.common.siteName}`,
      description,
      url: `${getSiteUrl()}/${locale}/skelbimas/${slug}`,
      images: image === null ? undefined : [{ url: image.public_url }],
    },
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const result = await fetchListingBySlug(slug);
  if (!result.ok) notFound();

  const { listing, seller } = result.data;
  const dict = getDictionary(locale);
  const groups = listingSpecGroups(listing, dict, locale);
  const published = listing.published_at ?? listing.created_at;
  const image = primaryImageOf(listing.images);

  // Structured data is emitted only with values that genuinely exist.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    ...(image === null ? {} : { image: [image.public_url] }),
    offers: {
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: listing.currency,
      itemCondition:
        listing.condition === 'new'
          ? 'https://schema.org/NewCondition'
          : 'https://schema.org/UsedCondition',
      availability: 'https://schema.org/InStock',
      url: `${getSiteUrl()}/${locale}/skelbimas/${listing.slug}`,
    },
  };

  return (
    <div className="shell py-6 sm:py-10">
      <script
        type="application/ld+json"
        // The payload is built from validated data, never from raw user HTML.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href={routes.category(locale, listing.category)}
        className="btn-quiet mb-4 -ml-3 text-sm"
      >
        <ArrowLeftIcon width={18} height={18} />
        {dict.listing.backToCatalog}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="space-y-8">
          <Gallery images={listing.images} title={listing.title} dict={dict} />

          <header>
            <p className="chip mb-3">{dict.category[listing.category]}</p>
            <h1 className="text-2xl sm:text-3xl">{listing.title}</h1>

            <p className="mt-4 font-display text-3xl font-extrabold">
              {formatPrice(listing.price, locale)}
            </p>

            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-ink-muted">{dict.listing.quantity}:</dt>
                <dd>
                  {listing.quantity} {dict.common.pieces}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-muted">{dict.specs.condition}:</dt>
                <dd>{dict.condition[listing.condition]}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-muted">{dict.listing.city}:</dt>
                <dd>
                  {listing.city}
                  {listing.area === null ? '' : `, ${listing.area}`}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-muted">{dict.listing.publishedAt}:</dt>
                <dd>
                  <time dateTime={published}>{formatDate(published, locale)}</time>
                </dd>
              </div>
            </dl>
          </header>

          <section>
            <h2 className="mb-4 text-xl">{dict.specs.title}</h2>
            <div className="space-y-6">
              {groups.map((group, groupIndex) => (
                <div key={group.title ?? groupIndex}>
                  {group.title !== null && (
                    <h3 className="mb-3 font-display text-base font-bold text-brand">
                      {group.title}
                    </h3>
                  )}
                  {group.rows.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      {dict.specs.notSpecified}
                    </p>
                  ) : (
                    <dl className="grid gap-x-6 sm:grid-cols-2">
                      {group.rows.map((specRow) => (
                        <div
                          key={specRow.label}
                          className="flex justify-between gap-4 border-b border-line py-2.5 text-sm"
                        >
                          <dt className="text-ink-muted">{specRow.label}</dt>
                          <dd className="text-right font-medium">
                            {specRow.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl">{dict.listing.description}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {listing.description}
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SellerContact
            seller={seller}
            dict={dict}
            shareTitle={listing.title}
          />
        </aside>
      </div>
    </div>
  );
}
