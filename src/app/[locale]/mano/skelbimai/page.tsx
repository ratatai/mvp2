import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ListingActions } from '@/components/dashboard/listing-actions';
import { ImageIcon, PlusIcon } from '@/components/ui/icons';
import { EmptyState, ErrorState } from '@/components/ui/states';
import type { ListingStatus } from '@/domain/canonical';
import { primaryImageOf } from '@/domain/listing.mapper';
import { getDictionary, type Dictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { formatDate, formatPrice } from '@/lib/format';
import { fetchOwnerListings } from '@/lib/repositories/listings';
import { routes } from '@/lib/routes';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

function statusLabel(status: ListingStatus, dict: Dictionary): string {
  switch (status) {
    case 'active':
      return dict.dashboard.statusActive;
    case 'draft':
      return dict.dashboard.statusDraft;
    case 'sold':
      return dict.dashboard.statusSold;
    case 'archived':
      return dict.dashboard.statusArchived;
  }
}

function statusTone(status: ListingStatus): string {
  switch (status) {
    case 'active':
      return 'border-success/50 text-success';
    case 'sold':
      return 'border-warning/50 text-warning';
    default:
      return '';
  }
}

export default async function MyListingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  const user = await getSessionUser();
  if (user === null) {
    redirect(
      `${routes.login(locale)}?next=${encodeURIComponent(routes.myListings(locale))}`
    );
  }

  const result = await fetchOwnerListings(user.id);

  return (
    <div className="shell py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">{dict.dashboard.listingsTitle}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {dict.dashboard.listingsSubtitle}
          </p>
        </div>
        <Link href={routes.createListing(locale)} className="btn-primary">
          <PlusIcon width={18} height={18} />
          {dict.dashboard.newListing}
        </Link>
      </div>

      {!result.ok ? (
        <ErrorState
          title={dict.errors.genericTitle}
          text={dict.errors.genericText}
          action={{ href: routes.dashboard(locale), label: dict.common.back }}
        />
      ) : result.data.length === 0 ? (
        <EmptyState
          title={dict.dashboard.emptyTitle}
          text={dict.dashboard.emptyText}
          action={{
            href: routes.createListing(locale),
            label: dict.nav.createListing,
          }}
        />
      ) : (
        <ul className="space-y-4">
          {result.data.map((listing) => {
            const image = primaryImageOf(listing.images);

            return (
              <li key={listing.id} className="card p-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative h-32 w-full flex-none overflow-hidden rounded-xl bg-bg-alt sm:h-24 sm:w-32">
                    {image === null ? (
                      <div className="flex h-full items-center justify-center text-ink-faint">
                        <ImageIcon />
                      </div>
                    ) : (
                      <Image
                        src={image.public_url}
                        alt=""
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="font-display text-base font-bold">
                        {listing.status === 'active' ? (
                          <Link
                            href={routes.listing(locale, listing.slug)}
                            className="hover:text-brand"
                          >
                            {listing.title}
                          </Link>
                        ) : (
                          listing.title
                        )}
                      </h2>

                      <span className={`chip ${statusTone(listing.status)}`}>
                        {statusLabel(listing.status, dict)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                      <span className="font-display font-bold text-ink">
                        {formatPrice(listing.price, locale)}
                      </span>
                      <span>
                        {listing.quantity} {dict.common.pieces}
                      </span>
                      <span>{dict.category[listing.category]}</span>
                      <span>{formatDate(listing.created_at, locale)}</span>
                    </div>

                    {listing.moderation_status !== 'approved' && (
                      <p className="text-xs text-warning">
                        {listing.moderation_status === 'pending'
                          ? dict.dashboard.moderationPending
                          : dict.dashboard.moderationRejected}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Link
                        href={routes.editListing(locale, listing.id)}
                        className="btn-ghost px-3 py-2 text-sm"
                      >
                        {dict.common.edit}
                      </Link>

                      <ListingActions
                        listingId={listing.id}
                        status={listing.status}
                        dict={dict}
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
