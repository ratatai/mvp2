'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { CloseIcon, FilterIcon } from '@/components/ui/icons';
import {
  LISTING_CONDITIONS,
  RIM_MATERIALS,
  TIRE_SEASONS,
  type ListingCategory,
} from '@/domain/canonical';
import {
  clearFilters,
  filtersToQueryString,
  hasActiveFilters,
  parseFilters,
  type CatalogFilters,
} from '@/domain/filters';
import type { Dictionary } from '@/i18n';

/** Local draft state: every field is a string while the visitor edits it. */
type Draft = Record<string, string>;

function toDraft(filters: CatalogFilters): Draft {
  const source = filters as unknown as Record<string, unknown>;
  const draft: Draft = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue;
    draft[key] = String(value);
  }

  return draft;
}

function fromDraft(draft: Draft, base: CatalogFilters): CatalogFilters {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(draft)) {
    if (value.trim().length === 0) continue;
    params.set(key, value.trim());
  }

  // The category lives in the route (/skelbimai/padangos), so it must not also
  // be repeated in the query string. Paging always restarts when filters
  // change, and the chosen sort order is preserved.
  params.delete('category');
  params.delete('page');
  params.set('sort', base.sort);

  // Round-tripping through the parser gives correctly typed values instead of
  // an object of strings pretending to be CatalogFilters.
  return parseFilters(params);
}

const TIRE_FIELDS = ['width', 'aspectRatio', 'diameter', 'season', 'brand', 'treadDepthMin', 'yearMin'] as const;
const RIM_FIELDS = ['diameter', 'rimWidth', 'boltCount', 'pcd', 'cb', 'etMin', 'etMax', 'material', 'brand'] as const;
const WHEEL_FIELDS = ['width', 'aspectRatio', 'diameter', 'season', 'rimWidth', 'pcd', 'cb', 'etMin', 'etMax'] as const;

function fieldsFor(category: ListingCategory | undefined): readonly string[] {
  switch (category) {
    case 'padangos':
      return TIRE_FIELDS;
    case 'ratlankiai':
      return RIM_FIELDS;
    case 'komplektiniai_ratai':
      return WHEEL_FIELDS;
    default:
      return [];
  }
}

export function FilterPanel({
  filters,
  dict,
  basePath,
  activeCount,
}: {
  filters: CatalogFilters;
  dict: Dictionary;
  basePath: string;
  activeCount: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(filters));
  const [open, setOpen] = useState(false);
  const formId = useId();

  // Keep the form in sync when the visitor navigates with Back/Forward.
  useEffect(() => {
    setDraft(toDraft(filters));
  }, [filters]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function set(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /**
   * `basePath` already encodes the category, so it is stripped from the query
   * string — otherwise every filtered URL would carry a redundant
   * `?category=padangos` that the route overrides anyway.
   */
  function pushFilters(next: CatalogFilters) {
    const query = filtersToQueryString({ ...next, category: undefined });
    setOpen(false);
    router.push(`${basePath}${query}`, { scroll: true });
  }

  function apply() {
    pushFilters(fromDraft(draft, filters));
  }

  function reset() {
    const next = clearFilters(filters);
    setDraft(toDraft(next));
    pushFilters(next);
  }

  const visible = new Set(fieldsFor(filters.category));

  const numberField = (
    key: string,
    label: string,
    extra?: { min?: number; max?: number; step?: number }
  ) => (
    <label key={key} className="block">
      <span className="field-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        className="field"
        value={draft[key] ?? ''}
        min={extra?.min}
        max={extra?.max}
        step={extra?.step ?? 1}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );

  // Rendered twice (desktop sidebar and mobile drawer), so each instance needs
  // its own id — two elements sharing one id is invalid HTML.
  const renderBody = (variant: 'desktop' | 'mobile') => (
    <form
      id={`${formId}-${variant}`}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <label className="block">
        <span className="field-label">{dict.filters.searchLabel}</span>
        <input
          type="search"
          className="field"
          placeholder={dict.filters.searchPlaceholder}
          value={draft['q'] ?? ''}
          onChange={(event) => set('q', event.target.value)}
        />
      </label>

      <label className="block">
        <span className="field-label">{dict.filters.condition}</span>
        <select
          className="field"
          value={draft['condition'] ?? ''}
          onChange={(event) => set('condition', event.target.value)}
        >
          <option value="">{dict.common.all}</option>
          {LISTING_CONDITIONS.map((value) => (
            <option key={value} value={value}>
              {dict.condition[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="field-label">{dict.filters.city}</span>
        <input
          type="text"
          className="field"
          placeholder={dict.filters.cityPlaceholder}
          value={draft['city'] ?? ''}
          onChange={(event) => set('city', event.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        {numberField('priceMin', dict.filters.priceFrom, { min: 0, step: 1 })}
        {numberField('priceMax', dict.filters.priceTo, { min: 0, step: 1 })}
      </div>

      {numberField('quantity', dict.filters.quantity, { min: 1, max: 100 })}

      {visible.size > 0 && (
        <fieldset className="space-y-4 border-t border-line pt-4">
          <legend className="eyebrow mb-1">
            {filters.category === 'ratlankiai'
              ? dict.filters.rimSection
              : dict.filters.tireSection}
          </legend>

          {visible.has('width') &&
            numberField('width', dict.filters.width, { min: 105, max: 405 })}
          {visible.has('aspectRatio') &&
            numberField('aspectRatio', dict.filters.aspectRatio, {
              min: 20,
              max: 95,
            })}
          {visible.has('diameter') &&
            numberField('diameter', dict.filters.diameter, { min: 10, max: 30 })}

          {visible.has('season') && (
            <label className="block">
              <span className="field-label">{dict.filters.season}</span>
              <select
                className="field"
                value={draft['season'] ?? ''}
                onChange={(event) => set('season', event.target.value)}
              >
                <option value="">{dict.common.all}</option>
                {TIRE_SEASONS.map((value) => (
                  <option key={value} value={value}>
                    {dict.season[value]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {visible.has('rimWidth') &&
            numberField('rimWidth', dict.filters.rimWidth, {
              min: 3,
              max: 16,
              step: 0.5,
            })}
          {visible.has('boltCount') &&
            numberField('boltCount', dict.filters.boltCount, { min: 3, max: 10 })}

          {visible.has('pcd') && (
            <label className="block">
              <span className="field-label">{dict.filters.pcd}</span>
              <input
                type="text"
                className="field"
                placeholder="5x112"
                value={draft['pcd'] ?? ''}
                onChange={(event) => set('pcd', event.target.value)}
              />
            </label>
          )}

          {visible.has('cb') &&
            numberField('cb', dict.filters.cb, { min: 40, max: 130, step: 0.1 })}

          {(visible.has('etMin') || visible.has('etMax')) && (
            <div className="grid grid-cols-2 gap-3">
              {numberField('etMin', dict.filters.etFrom, { min: -60, max: 90 })}
              {numberField('etMax', dict.filters.etTo, { min: -60, max: 90 })}
            </div>
          )}

          {visible.has('material') && (
            <label className="block">
              <span className="field-label">{dict.filters.material}</span>
              <select
                className="field"
                value={draft['material'] ?? ''}
                onChange={(event) => set('material', event.target.value)}
              >
                <option value="">{dict.common.all}</option>
                {RIM_MATERIALS.map((value) => (
                  <option key={value} value={value}>
                    {dict.material[value]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {visible.has('brand') && (
            <label className="block">
              <span className="field-label">{dict.filters.brand}</span>
              <input
                type="text"
                className="field"
                value={draft['brand'] ?? ''}
                onChange={(event) => set('brand', event.target.value)}
              />
            </label>
          )}

          {visible.has('treadDepthMin') &&
            numberField('treadDepthMin', dict.filters.treadDepthFrom, {
              min: 0,
              max: 20,
              step: 0.5,
            })}
          {visible.has('yearMin') &&
            numberField('yearMin', dict.filters.yearFrom, {
              min: 1980,
              max: 2100,
            })}
        </fieldset>
      )}

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1">
          {dict.common.apply}
        </button>
        {hasActiveFilters(filters) && (
          <button type="button" onClick={reset} className="btn-ghost">
            {dict.filters.reset}
          </button>
        )}
      </div>
    </form>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost w-full lg:hidden"
        aria-expanded={open}
      >
        <FilterIcon width={18} height={18} />
        {dict.filters.open}
        {activeCount > 0 && (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Desktop sidebar */}
      <div className="card hidden p-5 lg:block">
        <h2 className="mb-4 font-display text-lg font-bold">
          {dict.filters.title}
        </h2>
        {renderBody('desktop')}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-bg lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={dict.filters.title}
        >
          <div className="flex flex-none items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-display text-lg font-bold">
              {dict.filters.title}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost min-h-touch min-w-touch px-3"
              aria-label={dict.common.close}
              autoFocus
            >
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{renderBody('mobile')}</div>
        </div>
      )}
    </>
  );
}
