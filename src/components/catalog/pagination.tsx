import Link from 'next/link';

import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/icons';
import { filtersToQueryString, type CatalogFilters } from '@/domain/filters';
import type { Dictionary } from '@/i18n';
import { interpolate } from '@/i18n';

/**
 * Pagination rendered as plain links, so it works without JavaScript and
 * browser Back/Forward move between pages exactly as a visitor expects.
 */
export function Pagination({
  filters,
  totalPages,
  dict,
  basePath,
}: {
  filters: CatalogFilters;
  totalPages: number;
  dict: Dictionary;
  basePath: string;
}) {
  if (totalPages <= 1) return null;

  const page = filters.page;
  const hrefFor = (target: number) =>
    `${basePath}${filtersToQueryString({ ...filters, page: target })}`;

  return (
    <nav
      className="mt-8 flex items-center justify-between gap-3"
      aria-label={dict.catalog.sortBy}
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className="btn-ghost">
          <ArrowLeftIcon width={18} height={18} />
          <span className="hidden sm:inline">{dict.common.previous}</span>
        </Link>
      ) : (
        <span className="btn-ghost pointer-events-none opacity-40" aria-hidden>
          <ArrowLeftIcon width={18} height={18} />
          <span className="hidden sm:inline">{dict.common.previous}</span>
        </span>
      )}

      <p className="text-sm text-ink-muted" aria-live="polite">
        {interpolate(dict.catalog.pageOf, { page, total: totalPages })}
      </p>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className="btn-ghost">
          <span className="hidden sm:inline">{dict.common.next}</span>
          <ArrowRightIcon width={18} height={18} />
        </Link>
      ) : (
        <span className="btn-ghost pointer-events-none opacity-40" aria-hidden>
          <span className="hidden sm:inline">{dict.common.next}</span>
          <ArrowRightIcon width={18} height={18} />
        </span>
      )}
    </nav>
  );
}
