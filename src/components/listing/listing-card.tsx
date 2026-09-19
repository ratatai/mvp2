import Image from 'next/image';
import Link from 'next/link';

import { ImageIcon } from '@/components/ui/icons';
import type { Listing } from '@/domain/listing.contract';
import { primaryImageOf } from '@/domain/listing.mapper';
import type { Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { formatDate, formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { listingCardSummary } from '@/lib/spec-display';

/**
 * Catalog card.
 *
 * Images are lazy-loaded and served at card size through next/image, so a
 * page of 24 results never downloads 24 full-resolution photos.
 */
export function ListingCard({
  listing,
  dict,
  locale,
  priority = false,
}: {
  listing: Listing;
  dict: Dictionary;
  locale: Locale;
  priority?: boolean;
}) {
  const image = primaryImageOf(listing.images);
  const summary = listingCardSummary(listing, dict);
  const published = listing.published_at ?? listing.created_at;

  return (
    <article className="card group overflow-hidden hover:border-line-strong hover:bg-card-hover">
      <Link
        href={routes.listing(locale, listing.slug)}
        className="flex h-full flex-col focus-visible:ring-2 focus-visible:ring-brand"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-bg-alt">
          {image === null ? (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-faint"
              role="img"
              aria-label={dict.listing.noImages}
            >
              <ImageIcon width={28} height={28} />
              <span className="px-2 text-center text-xs">
                {dict.listing.noImages}
              </span>
            </div>
          ) : (
            <Image
              src={image.public_url}
              alt={listing.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              priority={priority}
              loading={priority ? undefined : 'lazy'}
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          )}

          <span className="absolute left-2.5 top-2.5 rounded-full bg-bg/80 px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur">
            {dict.category[listing.category]}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <h3 className="line-clamp-2 font-display text-base font-bold leading-snug">
            {listing.title}
          </h3>

          {summary.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {summary.map((item) => (
                <li key={item} className="chip">
                  {item}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-auto font-display text-xl font-extrabold text-ink">
            {formatPrice(listing.price, locale)}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <span>{dict.condition[listing.condition]}</span>
            <span aria-hidden>·</span>
            <span>
              {listing.quantity} {dict.common.pieces}
            </span>
            <span aria-hidden>·</span>
            <span>{listing.city}</span>
          </div>

          <time
            dateTime={published}
            className="text-xs text-ink-faint"
          >
            {formatDate(published, locale)}
          </time>
        </div>
      </Link>
    </article>
  );
}

/** Loading placeholder with the same footprint, so nothing shifts on load. */
export function ListingCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden>
      <div className="aspect-[4/3] w-full animate-pulse bg-bg-alt" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-bg-alt" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-bg-alt" />
        <div className="h-6 w-1/3 animate-pulse rounded bg-bg-alt" />
      </div>
    </div>
  );
}
