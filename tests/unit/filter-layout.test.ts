import { describe, it, expect } from 'vitest';

import {
  COMMON_FIELDS,
  filterLayout,
  hasActiveSecondary,
  nextMoreOpen,
  type FilterFieldKey,
} from '@/components/catalog/filter-layout';
import { LISTING_CATEGORIES } from '@/domain/canonical';
import {
  clearFilters,
  DEFAULT_FILTERS,
  parseFilters,
  type CatalogFilters,
} from '@/domain/filters';

const primaryFields = (layout: ReturnType<typeof filterLayout>): FilterFieldKey[] =>
  layout.primary.flatMap((group) => [...group.fields]);

const allFields = (layout: ReturnType<typeof filterLayout>): FilterFieldKey[] => [
  ...primaryFields(layout),
  ...layout.secondary,
];

describe('filterLayout', () => {
  it('leads tyres with width, profile and diameter', () => {
    const layout = filterLayout('padangos');
    expect(layout.primary.map((group) => group.id)).toEqual(['tire']);
    expect(primaryFields(layout)).toEqual(['width', 'aspectRatio', 'diameter']);
    expect(layout.secondary).toEqual(
      expect.arrayContaining(['season', 'brand', 'treadDepthMin', 'yearMin'])
    );
  });

  it('leads rims with PCD, CB, diameter and ET, keeping rim width and bolt count', () => {
    const layout = filterLayout('ratlankiai');
    expect(layout.primary.map((group) => group.id)).toEqual(['rim']);
    expect(primaryFields(layout)).toEqual(['pcd', 'cb', 'diameter', 'etMin', 'etMax']);
    expect(layout.secondary).toEqual(
      expect.arrayContaining(['rimWidth', 'boltCount', 'material', 'brand'])
    );
  });

  it('shows separate tyre and rim groups for complete wheels, including bolt count', () => {
    const layout = filterLayout('komplektiniai_ratai');
    expect(layout.primary.map((group) => group.id)).toEqual(['wheelTire', 'wheelRim']);

    const [tire, rim] = layout.primary;
    expect(tire?.fields).toEqual(['width', 'aspectRatio', 'diameter']);
    expect(rim?.fields).toEqual(['pcd', 'cb', 'etMin', 'etMax', 'rimWidth', 'boltCount']);
    expect(layout.secondary).toContain('season');
  });

  it('offers the shared complete-wheel diameter once', () => {
    const fields = allFields(filterLayout('komplektiniai_ratai'));
    expect(fields.filter((key) => key === 'diameter')).toHaveLength(1);
  });

  it.each(LISTING_CATEGORIES)('keeps every common filter, after the technical ones, for %s', (category) => {
    const layout = filterLayout(category);
    const fields = allFields(layout);

    expect(layout.primary.length).toBeGreaterThan(0);
    expect(layout.secondary).toEqual(expect.arrayContaining([...COMMON_FIELDS]));
    for (const key of COMMON_FIELDS) {
      expect(primaryFields(layout)).not.toContain(key);
    }
    expect(new Set(fields).size).toBe(fields.length);
  });

  it('shows only common filters without a category', () => {
    const layout = filterLayout(undefined);
    expect(layout.primary).toEqual([]);
    expect(layout.secondary).toEqual(COMMON_FIELDS);
  });

  it('uses only keys the canonical parser reads back', () => {
    const sample: Record<FilterFieldKey, string> = {
      q: 'michelin',
      condition: 'used',
      city: 'Kaunas',
      priceMin: '50',
      priceMax: '150',
      quantity: '4',
      width: '355',
      aspectRatio: '25',
      diameter: '21',
      season: 'winter',
      brand: 'BBS',
      treadDepthMin: '5.5',
      yearMin: '2019',
      rimWidth: '8.5',
      boltCount: '5',
      pcd: '5x112',
      cb: '66.6',
      etMin: '-10',
      etMax: '45',
      material: 'alloy',
    };

    for (const category of LISTING_CATEGORIES) {
      const params = new URLSearchParams();
      for (const key of allFields(filterLayout(category))) params.set(key, sample[key]);
      const parsed = parseFilters(params) as unknown as Record<string, unknown>;

      for (const key of allFields(filterLayout(category))) {
        expect(parsed[key], `${category}.${key}`).toBeDefined();
      }
    }
  });
});

describe('hasActiveSecondary', () => {
  const layout = filterLayout('ratlankiai');

  it('is false when only primary filters are set', () => {
    const filters: CatalogFilters = { ...DEFAULT_FILTERS, pcd: '5x112', etMin: -10 };
    expect(hasActiveSecondary(layout, filters)).toBe(false);
  });

  it('is true when a collapsed filter is set', () => {
    const filters: CatalogFilters = { ...DEFAULT_FILTERS, boltCount: 5 };
    expect(hasActiveSecondary(layout, filters)).toBe(true);
  });
});

describe('nextMoreOpen', () => {
  const url = (path: string) => parseFilters(new URLSearchParams(path));

  it('opens the section when Back/Forward lands on a collapsed filter', () => {
    // Visitor collapsed the section on a primary-only URL, then pressed Back
    // to a URL that sets bolt count.
    const back = url('category=ratlankiai&pcd=5x112&boltCount=5');
    expect(nextMoreOpen(false, back)).toBe(true);
  });

  it('opens the section when a category link sets one of its collapsed filters', () => {
    expect(nextMoreOpen(false, url('category=padangos&season=winter'))).toBe(true);
    expect(nextMoreOpen(false, url('category=komplektiniai_ratai&priceMax=500'))).toBe(true);
  });

  it('keeps a collapsed section closed when only technical filters are set', () => {
    expect(nextMoreOpen(false, url('category=ratlankiai&pcd=5x112&etMin=-10&etMax=45'))).toBe(
      false
    );
  });

  it('keeps a section the visitor opened open across navigation and after reset', () => {
    expect(nextMoreOpen(true, url('category=padangos&width=205'))).toBe(true);
    expect(nextMoreOpen(true, clearFilters(url('category=padangos&brand=Nokian')))).toBe(true);
  });

  it('does not reopen a closed section after reset clears every value', () => {
    const cleared = clearFilters(url('category=ratlankiai&boltCount=5&city=Vilnius'));
    expect(hasActiveSecondary(filterLayout(cleared.category), cleared)).toBe(false);
    expect(nextMoreOpen(false, cleared)).toBe(false);
  });

  it('treats a filter that is collapsed in one category but technical in another by layout', () => {
    // ET is technical for rims and absent from the tyre layout entirely.
    expect(nextMoreOpen(false, url('category=ratlankiai&etMin=-5'))).toBe(false);
    // Bolt count is collapsed for rims but technical for complete wheels.
    expect(nextMoreOpen(false, url('category=komplektiniai_ratai&boltCount=5'))).toBe(false);
  });
});
