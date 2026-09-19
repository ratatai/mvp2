import {
  ListingCard,
  ListingCardSkeleton,
} from '@/components/listing/listing-card';
import type { Listing } from '@/domain/listing.contract';
import type { Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

export function ListingGrid({
  listings,
  dict,
  locale,
}: {
  listings: readonly Listing[];
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing, index) => (
        <li key={listing.id}>
          {/* The first row is above the fold on most screens. */}
          <ListingCard
            listing={listing}
            dict={dict}
            locale={locale}
            priority={index < 4}
          />
        </li>
      ))}
    </ul>
  );
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <ListingCardSkeleton key={index} />
      ))}
    </div>
  );
}
