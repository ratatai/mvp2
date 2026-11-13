import { describe, it, expect } from 'vitest';

import {
  DEFAULT_FILTERS,
  clearFilters,
  filtersToQueryString,
  filtersToSearchParams,
  parseFilters,
  withFilter,
  type CatalogFilters,
} from '@/domain/filters';

describe('parseFilters', () => {
  it('reads a full query string correctly', () => {
    const query =
      'category=padangos&q=michelin&condition=new&city=Kaunas' +
      '&priceMin=50&priceMax=150&quantity=2' +
      '&width=225&aspectRatio=45&diameter=17&season=winter&brand=Nokian' +
      '&treadDepthMin=5.5&yearMin=2019' +
      '&rimWidth=7.5&boltCount=5&pcd=5x112&cb=66.6&etMin=20&etMax=45&material=steel' +
      '&sort=price_asc&page=2';

    const filters = parseFilters(new URLSearchParams(query));

    expect(filters).toEqual({
      category: 'padangos',
      q: 'michelin',
      condition: 'new',
      city: 'Kaunas',
      priceMin: 50,
      priceMax: 150,
      quantity: 2,
      width: 225,
      aspectRatio: 45,
      diameter: 17,
      season: 'winter',
      brand: 'Nokian',
      treadDepthMin: 5.5,
      yearMin: 2019,
      rimWidth: 7.5,
      boltCount: 5,
      pcd: '5x112',
      cb: 66.6,
      etMin: 20,
      etMax: 45,
      material: 'steel',
      sort: 'price_asc',
      page: 2,
    });
  });

  it('accepts the plain object shape Next.js hands to pages', () => {
    const filters = parseFilters({
      category: 'ratlankiai',
      width: ['205', '225'],
      sort: 'price_desc',
      page: undefined,
    });

    expect(filters.category).toBe('ratlankiai');
    expect(filters.width).toBe(205);
    expect(filters.sort).toBe('price_desc');
    expect(filters.page).toBe(1);
  });

  it('drops unknown, out-of-range and malformed values instead of throwing', () => {
    const query =
      'category=motorai&condition=broken&season=ruduo&material=wood&sort=cheapest' +
      '&page=0&width=10&diameter=999&quantity=0&yearMin=1800' +
      '&priceMin=abc&priceMax=&pcd=5x&cb=1000&etMin=-999&somethingElse=1';

    expect(() => parseFilters(new URLSearchParams(query))).not.toThrow();

    expect(parseFilters(new URLSearchParams(query))).toEqual({
      sort: 'newest',
      page: 1,
    });
  });

  it('drops a blank or whitespace only text filter', () => {
    const filters = parseFilters(new URLSearchParams('q=   &city=&brand='));

    expect(filters).toEqual({ sort: 'newest', page: 1 });
  });

  it('swaps reversed price bounds', () => {
    const filters = parseFilters(new URLSearchParams('priceMin=300&priceMax=100'));

    expect(filters.priceMin).toBe(100);
    expect(filters.priceMax).toBe(300);
  });

  it('swaps reversed et bounds', () => {
    const filters = parseFilters(new URLSearchParams('etMin=45&etMax=-10'));

    expect(filters.etMin).toBe(-10);
    expect(filters.etMax).toBe(45);
  });

  it('keeps bounds that are already in order', () => {
    const filters = parseFilters(
      new URLSearchParams('priceMin=100&priceMax=300&etMin=-10&etMax=45')
    );

    expect(filters.priceMin).toBe(100);
    expect(filters.priceMax).toBe(300);
    expect(filters.etMin).toBe(-10);
    expect(filters.etMax).toBe(45);
  });

  it('accepts whole, signed, decimal and boundary numbers with surrounding whitespace', () => {
    const expected = {
      sort: 'newest',
      page: 3,
      priceMin: 0,
      priceMax: 1_000_000,
      width: 405,
      treadDepthMin: 5.5,
      rimWidth: 7.5,
      cb: 66.6,
      etMin: -60,
      etMax: 90,
    };

    const query =
      'page=%203%20&priceMin=0&priceMax=1000000.00&width=405' +
      '&treadDepthMin=5.5&rimWidth=%207.5&cb=66.6&etMin=-60&etMax=90';

    expect(parseFilters(new URLSearchParams(query))).toEqual(expected);
    expect(
      parseFilters({
        page: ' 3 ',
        priceMin: '0',
        priceMax: '1000000.00',
        width: ['405', '205'],
        treadDepthMin: '5.5',
        rimWidth: ' 7.5',
        cb: '66.6',
        etMin: '-60',
        etMax: '90',
      })
    ).toEqual(expected);
  });

  it('accepts explicitly signed values and still swaps reversed et bounds', () => {
    const filters = parseFilters({ etMin: '+15', etMax: '-5', cb: '+57.1' });

    expect(filters.etMin).toBe(-5);
    expect(filters.etMax).toBe(15);
    expect(filters.cb).toBe(57.1);
  });

  it('drops values that are only partly numeric instead of reading a prefix', () => {
    const query =
      'etMin=12.5&etMax=20px&cb=66.6abc&width=205.5&page=2.0&quantity=4x' +
      '&priceMin=50eur&priceMax=1e3&rimWidth=7,5&treadDepthMin=0x5' +
      '&yearMin=Infinity&boltCount=NaN&diameter=%20&aspectRatio=';

    const expected = { sort: 'newest', page: 1 };

    expect(parseFilters(new URLSearchParams(query))).toEqual(expected);
    expect(
      parseFilters({
        etMin: '12.5',
        etMax: '20px',
        cb: '66.6abc',
        width: '205.5',
        page: '2.0',
        quantity: '4x',
        priceMin: '50eur',
        priceMax: '1e3',
        rimWidth: '7,5',
        treadDepthMin: '0x5',
        yearMin: 'Infinity',
        boltCount: 'NaN',
        diameter: '   ',
        aspectRatio: '',
      })
    ).toEqual(expected);
  });

  it('drops a bare dot, a trailing dot, a double sign and signed infinity', () => {
    const filters = parseFilters({
      cb: '.5',
      rimWidth: '7.',
      priceMin: '--5',
      priceMax: '-Infinity',
    });

    expect(filters).toEqual({ sort: 'newest', page: 1 });
  });

  it('still drops a well-formed value that is out of range', () => {
    const filters = parseFilters({ etMin: '-61', etMax: '91', cb: '130.1', priceMax: '-0.5' });

    expect(filters).toEqual({ sort: 'newest', page: 1 });
  });
});

describe('filters round trip', () => {
  const cases: ReadonlyArray<readonly [string, CatalogFilters]> = [
    ['empty', { ...DEFAULT_FILTERS }],
    [
      'tires',
      {
        category: 'padangos',
        q: 'michelin primacy',
        condition: 'used',
        city: 'Vilnius',
        priceMin: 20,
        priceMax: 200,
        quantity: 4,
        width: 205,
        aspectRatio: 55,
        diameter: 16,
        season: 'summer',
        brand: 'Michelin',
        treadDepthMin: 6.5,
        yearMin: 2018,
        sort: 'price_asc',
        page: 3,
      },
    ],
    [
      'rims',
      {
        category: 'ratlankiai',
        rimWidth: 8.5,
        boltCount: 5,
        pcd: '5x112',
        cb: 66.6,
        etMin: -10,
        etMax: 45,
        material: 'alloy',
        sort: 'price_desc',
        page: 1,
      },
    ],
    [
      'complete wheels',
      {
        category: 'komplektiniai_ratai',
        diameter: 18,
        material: 'forged',
        season: 'all_season',
        sort: 'newest',
        page: 7,
      },
    ],
    ['search only', { q: '205/55 r16', sort: 'newest', page: 1 }],
  ];

  for (const [name, filters] of cases) {
    it(`survives filtersToSearchParams → parseFilters for the ${name} case`, () => {
      expect(parseFilters(filtersToSearchParams(filters))).toEqual(filters);
    });
  }
});

describe('filtersToSearchParams', () => {
  it('omits sort=newest and page=1', () => {
    const params = filtersToSearchParams({ ...DEFAULT_FILTERS, width: 205 });

    expect(params.has('sort')).toBe(false);
    expect(params.has('page')).toBe(false);
    expect(params.get('width')).toBe('205');
  });

  it('keeps a non default sort and page', () => {
    const params = filtersToSearchParams({ sort: 'price_asc', page: 4 });

    expect(params.get('sort')).toBe('price_asc');
    expect(params.get('page')).toBe('4');
  });
});

describe('filtersToQueryString', () => {
  it('returns an empty string for the default filters', () => {
    expect(filtersToQueryString({ ...DEFAULT_FILTERS })).toBe('');
  });

  it('omits sort=newest and page=1', () => {
    const query = filtersToQueryString({ sort: 'newest', page: 1, width: 205, season: 'winter' });

    expect(query.includes('sort=')).toBe(false);
    expect(query.includes('page=')).toBe(false);
    expect(query.startsWith('?')).toBe(true);
    expect(query.includes('width=205')).toBe(true);
    expect(query.includes('season=winter')).toBe(true);
  });
});

describe('withFilter', () => {
  it('sets a value and resets pagination', () => {
    const next = withFilter({ sort: 'price_asc', page: 6, category: 'padangos' }, 'width', 205);

    expect(next.width).toBe(205);
    expect(next.page).toBe(1);
    expect(next.sort).toBe('price_asc');
    expect(next.category).toBe('padangos');
  });

  it('removes the key when the value is undefined', () => {
    const next = withFilter({ sort: 'newest', page: 4, width: 205 }, 'width', undefined);

    expect('width' in next).toBe(false);
    expect(next.page).toBe(1);
  });

  it('does not mutate the filters it was given', () => {
    const filters: CatalogFilters = { sort: 'newest', page: 4, width: 205 };

    withFilter(filters, 'width', 225);

    expect(filters.width).toBe(205);
    expect(filters.page).toBe(4);
  });
});

describe('clearFilters', () => {
  it('keeps the category and drops everything else', () => {
    const cleared = clearFilters({
      category: 'ratlankiai',
      q: 'bbs',
      material: 'alloy',
      boltCount: 5,
      sort: 'price_desc',
      page: 5,
    });

    expect(cleared).toEqual({ category: 'ratlankiai', sort: 'newest', page: 1 });
  });

  it('returns the defaults when no category is selected', () => {
    const cleared = clearFilters({ q: 'bbs', sort: 'price_desc', page: 5 });

    expect(cleared).toEqual({ sort: 'newest', page: 1 });
  });
});
