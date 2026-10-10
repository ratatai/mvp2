'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';

import {
  filterLayout,
  hasActiveSecondary,
  type FilterFieldKey,
  type FilterGroupId,
} from '@/components/catalog/filter-layout';
import { CloseIcon, FilterIcon } from '@/components/ui/icons';
import {
  LISTING_CONDITIONS,
  RIM_MATERIALS,
  TIRE_SEASONS,
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

function groupLegend(id: FilterGroupId, dict: Dictionary): string {
  switch (id) {
    case 'tire':
      return dict.filters.tireSection;
    case 'rim':
      return dict.filters.rimSection;
    case 'wheelTire':
      return dict.filters.wheelTireSection;
    case 'wheelRim':
      return dict.filters.wheelRimSection;
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
  const layout = filterLayout(filters.category);
  const [moreOpen, setMoreOpen] = useState(() => hasActiveSecondary(layout, filters));
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

  const hint = (text: string) => (
    <span className="mt-1 block text-xs text-ink-muted">{text}</span>
  );

  const numberField = (
    key: string,
    label: string,
    extra?: { min?: number; max?: number; step?: number; hint?: string }
  ) => (
    <label key={key} className="block min-w-0">
      <span className="field-label">{label}</span>
      <input
        type="number"
        inputMode={extra?.min !== undefined && extra.min < 0 ? 'text' : 'decimal'}
        className="field"
        value={draft[key] ?? ''}
        min={extra?.min}
        max={extra?.max}
        step={extra?.step ?? 1}
        onChange={(event) => set(key, event.target.value)}
      />
      {extra?.hint !== undefined && hint(extra.hint)}
    </label>
  );

  const textField = (key: string, label: string, placeholder?: string) => (
    <label key={key} className="block min-w-0">
      <span className="field-label">{label}</span>
      <input
        type={key === 'q' ? 'search' : 'text'}
        className="field"
        placeholder={placeholder}
        value={draft[key] ?? ''}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );

  const selectField = (
    key: string,
    label: string,
    values: readonly string[],
    names: Record<string, string>
  ) => (
    <label key={key} className="block min-w-0">
      <span className="field-label">{label}</span>
      <select
        className="field"
        value={draft[key] ?? ''}
        onChange={(event) => set(key, event.target.value)}
      >
        <option value="">{dict.common.all}</option>
        {values.map((value) => (
          <option key={value} value={value}>
            {names[value]}
          </option>
        ))}
      </select>
    </label>
  );

  const pair = (key: string, first: ReactNode, second: ReactNode) => (
    <div key={key} className="grid grid-cols-2 gap-3">
      {first}
      {second}
    </div>
  );

  /**
   * One control per canonical key. Range pairs (price, ET) are drawn at their
   * first key and skipped at the second, so both halves stay side by side.
   */
  function renderField(key: FilterFieldKey, group?: FilterGroupId): ReactNode {
    switch (key) {
      case 'q':
        return textField('q', dict.filters.searchLabel, dict.filters.searchPlaceholder);
      case 'condition':
        return selectField('condition', dict.filters.condition, LISTING_CONDITIONS, dict.condition);
      case 'city':
        return textField('city', dict.filters.city, dict.filters.cityPlaceholder);
      case 'priceMin':
        return pair(
          'price',
          numberField('priceMin', dict.filters.priceFrom, { min: 0, step: 1 }),
          numberField('priceMax', dict.filters.priceTo, { min: 0, step: 1 })
        );
      case 'quantity':
        return numberField('quantity', dict.filters.quantity, { min: 1, max: 100 });
      case 'width':
        return numberField('width', dict.filters.width, { min: 105, max: 405 });
      case 'aspectRatio':
        return numberField('aspectRatio', dict.filters.aspectRatio, { min: 20, max: 95 });
      case 'diameter':
        return numberField('diameter', dict.filters.diameter, {
          min: 10,
          max: 30,
          hint: group === 'wheelTire' ? dict.filters.diameterWheelHint : undefined,
        });
      case 'season':
        return selectField('season', dict.filters.season, TIRE_SEASONS, dict.season);
      case 'brand':
        return textField('brand', dict.filters.brand);
      case 'treadDepthMin':
        return numberField('treadDepthMin', dict.filters.treadDepthFrom, {
          min: 0,
          max: 20,
          step: 0.5,
        });
      case 'yearMin':
        return numberField('yearMin', dict.filters.yearFrom, { min: 1980, max: 2100 });
      case 'rimWidth':
        return numberField('rimWidth', dict.filters.rimWidth, { min: 3, max: 16, step: 0.5 });
      case 'boltCount':
        return numberField('boltCount', dict.filters.boltCount, {
          min: 3,
          max: 10,
          hint: dict.filters.boltCountHint,
        });
      case 'pcd':
        return textField('pcd', dict.filters.pcd, '5x112');
      case 'cb':
        return numberField('cb', dict.filters.cb, { min: 40, max: 130, step: 0.1 });
      case 'etMin':
        return pair(
          'et',
          numberField('etMin', dict.filters.etFrom, { min: -60, max: 90 }),
          numberField('etMax', dict.filters.etTo, { min: -60, max: 90 })
        );
      case 'material':
        return selectField('material', dict.filters.material, RIM_MATERIALS, dict.material);
      case 'priceMax':
      case 'etMax':
        return null;
    }
  }

  // Rendered twice (desktop sidebar and mobile drawer), so each instance needs
  // its own id — two elements sharing one id is invalid HTML.
  const renderBody = (variant: 'desktop' | 'mobile') => {
    const moreId = `${formId}-${variant}-more`;
    const secondary = layout.secondary.map((key) => renderField(key));

    return (
      <form
        id={`${formId}-${variant}`}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        {layout.primary.map((group) => (
          <fieldset key={group.id} className="min-w-0 space-y-4">
            <legend className="eyebrow mb-1">{groupLegend(group.id, dict)}</legend>
            {group.fields.map((key) => renderField(key, group.id))}
          </fieldset>
        ))}

        {layout.primary.length === 0 ? (
          secondary
        ) : (
          <div className="border-t border-line pt-4">
            <button
              type="button"
              className="btn-ghost w-full justify-between"
              aria-expanded={moreOpen}
              aria-controls={moreId}
              onClick={() => setMoreOpen((current) => !current)}
            >
              {dict.filters.moreFilters}
              <span aria-hidden="true">{moreOpen ? '−' : '+'}</span>
            </button>
            <div id={moreId} hidden={!moreOpen} className="mt-4 space-y-4">
              {secondary}
            </div>
          </div>
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
  };

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
