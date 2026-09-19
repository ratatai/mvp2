'use client';

import { useRouter } from 'next/navigation';

import { LISTING_SORTS, isListingSort } from '@/domain/canonical';
import { filtersToQueryString, type CatalogFilters } from '@/domain/filters';
import type { Dictionary } from '@/i18n';

export function SortSelect({
  filters,
  dict,
  basePath,
}: {
  filters: CatalogFilters;
  dict: Dictionary;
  basePath: string;
}) {
  const router = useRouter();

  const labels: Record<(typeof LISTING_SORTS)[number], string> = {
    newest: dict.catalog.sortNewest,
    price_asc: dict.catalog.sortPriceAsc,
    price_desc: dict.catalog.sortPriceDesc,
  };

  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      <span className="whitespace-nowrap">{dict.catalog.sortBy}</span>
      <select
        className="field min-h-touch w-auto py-2"
        value={filters.sort}
        onChange={(event) => {
          const value = event.target.value;
          if (!isListingSort(value)) return;
          const next: CatalogFilters = { ...filters, sort: value, page: 1 };
          router.push(`${basePath}${filtersToQueryString(next)}`);
        }}
      >
        {LISTING_SORTS.map((value) => (
          <option key={value} value={value}>
            {labels[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
