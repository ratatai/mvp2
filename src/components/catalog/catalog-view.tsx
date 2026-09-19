import Link from 'next/link';

import { FilterPanel } from '@/components/catalog/filter-panel';
import { Pagination } from '@/components/catalog/pagination';
import { SortSelect } from '@/components/catalog/sort-select';
import { ListingGrid } from '@/components/listing/listing-grid';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { LISTING_CATEGORIES } from '@/domain/canonical';
import {
  filtersToQueryString,
  filtersToSearchParams,
  type CatalogFilters,
} from '@/domain/filters';
import { CATALOG_PAGE_SIZE } from '@/domain/listing.contract';
import { getDictionary, interpolate } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { fetchPublicListings } from '@/lib/repositories/listings';
import { routes } from '@/lib/routes';

function countActiveFilters(filters: CatalogFilters): number {
  const params = filtersToSearchParams(filters);
  params.delete('page');
  params.delete('sort');
  params.delete('category');
  return Array.from(params.keys()).length;
}

/**
 * The shared catalog body, used by the all-categories route and by each
 * category route. The URL is the only state: filters, sorting and the page
 * number all live in the query string.
 */
export async function CatalogView({
  filters,
  locale,
  basePath,
  title,
  subtitle,
}: {
  filters: CatalogFilters;
  locale: Locale;
  basePath: string;
  title: string;
  subtitle: string;
}) {
  const dict = getDictionary(locale);
  const result = await fetchPublicListings(filters);

  const activeCount = countActiveFilters(filters);

  return (
    <div className="shell py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">{subtitle}</p>
      </header>

      {/* Category tabs */}
      <nav className="mb-6 flex flex-wrap gap-2" aria-label={dict.filters.category}>
        <Link
          href={`${routes.catalog(locale)}${filtersToQueryString({
            ...filters,
            category: undefined,
            page: 1,
          })}`}
          className={`chip min-h-touch px-4 ${
            filters.category === undefined
              ? 'border-brand bg-brand/10 text-ink'
              : ''
          }`}
        >
          {dict.common.all}
        </Link>
        {LISTING_CATEGORIES.map((category) => (
          <Link
            key={category}
            href={routes.category(locale, category)}
            className={`chip min-h-touch px-4 ${
              filters.category === category
                ? 'border-brand bg-brand/10 text-ink'
                : ''
            }`}
          >
            {dict.category[category]}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <FilterPanel
            filters={filters}
            dict={dict}
            basePath={basePath}
            activeCount={activeCount}
          />
        </aside>

        <section aria-live="polite">
          {!result.ok ? (
            <ErrorState
              title={dict.errors.genericTitle}
              text={dict.catalog.loadError}
              action={{ href: routes.catalog(locale), label: dict.common.retry }}
            />
          ) : result.data.items.length === 0 ? (
            <EmptyState
              title={dict.catalog.noResultsTitle}
              text={dict.catalog.noResultsText}
              action={
                activeCount > 0
                  ? { href: basePath, label: dict.catalog.clearFilters }
                  : undefined
              }
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">
                  {interpolate(dict.catalog.resultsCount, {
                    count: result.data.total,
                  })}
                </p>
                <SortSelect filters={filters} dict={dict} basePath={basePath} />
              </div>

              <ListingGrid
                listings={result.data.items}
                dict={dict}
                locale={locale}
              />

              <Pagination
                filters={filters}
                totalPages={Math.max(
                  1,
                  Math.ceil(result.data.total / CATALOG_PAGE_SIZE)
                )}
                dict={dict}
                basePath={basePath}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
