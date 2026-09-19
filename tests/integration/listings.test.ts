/**
 * Integration tests for src/lib/repositories/listings.ts.
 *
 * No database is involved: `@/lib/supabase/server` is mocked with the
 * chainable fake in ./fake-supabase.ts, which records the query the
 * repository builds and returns canned rows. What is asserted here is the
 * contract the rest of the application depends on:
 *
 *   • the public catalog is always scoped to active + approved;
 *   • owner queries are always scoped to the owner;
 *   • spec filters resolve to the right JSON path per category;
 *   • pagination and sorting are stable;
 *   • a raw PostgREST message never leaves the module.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CatalogFilters } from '@/domain/filters';
import type { ListingDraft } from '@/domain/listing.contract';
import { CATALOG_PAGE_SIZE } from '@/domain/listing.contract';

import {
  callsOf,
  createFakeSupabase,
  eqPairs,
  filterTriples,
  firstArgOf,
  hasEq,
  orderPairs,
  pgError,
  type FakeSupabase,
  type FakeSupabaseOptions,
  type RecordedQuery,
} from './fake-supabase';
import {
  imageRow,
  listingRow,
  OTHER_USER_ID,
  rowWithImages,
  TEST_LISTING_ID,
  TEST_USER_ID,
  TIRE_SPECS,
} from './fixtures';

/* -------------------------------------------------------------------------- */
/* Module mock                                                                 */
/* -------------------------------------------------------------------------- */

// `vi.mock` is hoisted above the imports, so the client it hands out has to be
// reachable through a hoisted holder rather than a module-level `let`.
const holder = vi.hoisted(() => ({
  createClient: (): Promise<unknown> =>
    Promise.reject(new Error('the fake Supabase client was not installed')),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => holder.createClient(),
  getSessionUser: () => Promise.resolve(null),
}));

import {
  createListing,
  deleteListing,
  fetchListingBySlug,
  fetchOwnedListingById,
  fetchOwnerListings,
  fetchPublicListings,
  fetchPublicSlugs,
  setListingStatus,
  specPath,
  updateListing,
} from '@/lib/repositories/listings';

/* -------------------------------------------------------------------------- */
/* Harness                                                                     */
/* -------------------------------------------------------------------------- */

function install(options: FakeSupabaseOptions = {}): FakeSupabase {
  const fake = createFakeSupabase(options);
  holder.createClient = () => Promise.resolve(fake.client);
  return fake;
}

function filters(overrides: Partial<CatalogFilters> = {}): CatalogFilters {
  return { sort: 'newest', page: 1, ...overrides };
}

/** Every error code the repository is allowed to expose. */
const REPO_ERROR_CODES: readonly string[] = [
  'not_found',
  'not_authenticated',
  'forbidden',
  'validation',
  'conflict',
  'unavailable',
];

const DB_LEAK = 'relation "listings" does not exist';

/**
 * Asserts a failed result carries one of the small codes and that no fragment
 * of the database error survived anywhere in the returned value.
 */
function expectSafeFailure(result: { readonly ok: boolean }): void {
  expect(result.ok).toBe(false);

  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain(DB_LEAK);
  expect(serialized).not.toContain('does not exist');
  expect(serialized).not.toContain('detail for');
  expect(serialized).not.toContain('hint for');
  expect(serialized).not.toContain('PostgrestError');
  expect(serialized).not.toContain('duplicate key');

  const code = (result as { readonly error?: unknown }).error;
  expect(typeof code).toBe('string');
  expect(REPO_ERROR_CODES).toContain(code);
}

/** Index access that fails loudly instead of returning undefined. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`expected an item at index ${index}, found none`);
  }
  return item;
}

function insertPayload(query: RecordedQuery): Record<string, unknown> {
  const payload = at(callsOf(query, 'insert'), 0).args[0];
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('no insert payload was recorded');
  }
  return payload as Record<string, unknown>;
}

beforeEach(() => {
  // The repository logs the raw error server-side in development; keep the
  // test output clean while still exercising that code path.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  holder.createClient = () =>
    Promise.reject(new Error('the fake Supabase client was not installed'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* specPath                                                                    */
/* -------------------------------------------------------------------------- */

describe('specPath', () => {
  it('resolves flat paths for plain tires', () => {
    expect(specPath('padangos', 'width')).toBe('specs->width');
    expect(specPath('padangos', 'aspect_ratio')).toBe('specs->aspect_ratio');
    expect(specPath('padangos', 'diameter')).toBe('specs->diameter');
    expect(specPath('padangos', 'brand')).toBe('specs->brand');
    expect(specPath('padangos', 'brand', true)).toBe('specs->>brand');
  });

  it('resolves nested paths for complete wheels', () => {
    expect(specPath('komplektiniai_ratai', 'width')).toBe('specs->tire->width');
    expect(specPath('komplektiniai_ratai', 'pcd')).toBe('specs->rim->pcd');
    expect(specPath('komplektiniai_ratai', 'season')).toBe('specs->tire->season');
    expect(specPath('komplektiniai_ratai', 'rim_width')).toBe(
      'specs->rim->rim_width'
    );
    // Shared fields live on the tire half, which is what buyers search by.
    expect(specPath('komplektiniai_ratai', 'diameter')).toBe(
      'specs->tire->diameter'
    );
    expect(specPath('komplektiniai_ratai', 'cb', true)).toBe('specs->rim->>cb');
  });

  it('returns null for a field the category does not have', () => {
    // Rim-only fields do not exist on a tire listing…
    expect(specPath('padangos', 'pcd')).toBeNull();
    expect(specPath('padangos', 'et')).toBeNull();
    expect(specPath('padangos', 'material')).toBeNull();
    expect(specPath('padangos', 'bolt_count')).toBeNull();
    expect(specPath('padangos', 'cb')).toBeNull();
    expect(specPath('padangos', 'rim_width')).toBeNull();

    // …and tire-only fields do not exist on a rim listing.
    expect(specPath('ratlankiai', 'width')).toBeNull();
    expect(specPath('ratlankiai', 'aspect_ratio')).toBeNull();
    expect(specPath('ratlankiai', 'season')).toBeNull();
    expect(specPath('ratlankiai', 'tread_depth')).toBeNull();
    expect(specPath('ratlankiai', 'manufacturing_year')).toBeNull();

    // Rims keep their own fields flat.
    expect(specPath('ratlankiai', 'pcd')).toBe('specs->pcd');
    expect(specPath('ratlankiai', 'diameter')).toBe('specs->diameter');
  });
});

/* -------------------------------------------------------------------------- */
/* fetchPublicListings — scoping                                               */
/* -------------------------------------------------------------------------- */

describe('fetchPublicListings visibility scoping', () => {
  it('always constrains status=active and moderation_status=approved', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    const result = await fetchPublicListings(filters());

    expect(result.ok).toBe(true);

    const query = fake.onlyQueryFor('listings');
    expect(hasEq(query, 'status', 'active')).toBe(true);
    expect(hasEq(query, 'moderation_status', 'approved')).toBe(true);
  });

  it('keeps both visibility constraints even with every other filter set', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(
      filters({
        category: 'ratlankiai',
        condition: 'new',
        city: 'Vilnius',
        priceMin: 10,
        priceMax: 900,
        quantity: 4,
        pcd: '5x112',
        sort: 'price_desc',
        page: 3,
      })
    );

    const query = fake.onlyQueryFor('listings');
    expect(hasEq(query, 'status', 'active')).toBe(true);
    expect(hasEq(query, 'moderation_status', 'approved')).toBe(true);
  });

  it('applies the category filter when one is selected', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(filters({ category: 'padangos' }));

    expect(hasEq(fake.onlyQueryFor('listings'), 'category', 'padangos')).toBe(true);
  });

  it('omits the category filter when no category is selected', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(filters());

    const columns = eqPairs(fake.onlyQueryFor('listings')).map(([column]) => column);
    expect(columns).not.toContain('category');
  });
});

/* -------------------------------------------------------------------------- */
/* fetchPublicListings — spec filters                                          */
/* -------------------------------------------------------------------------- */

describe('fetchPublicListings technical filters', () => {
  it('ignores technical filters when no category is selected', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(
      filters({
        width: 205,
        aspectRatio: 55,
        diameter: 16,
        season: 'winter',
        brand: 'Testlandia',
        rimWidth: 8.5,
        boltCount: 5,
        pcd: '5x112',
        cb: 66.6,
        etMin: 20,
        etMax: 45,
        material: 'alloy',
        treadDepthMin: 5,
        yearMin: 2020,
      })
    );

    const query = fake.onlyQueryFor('listings');
    // Technical filters are the only thing that reaches `.filter()`.
    expect(filterTriples(query)).toHaveLength(0);
    // …and no spec column sneaks in through ilike either.
    for (const call of callsOf(query, 'ilike')) {
      expect(String(call.args[0])).not.toContain('specs');
    }
  });

  it('translates tire filters to flat spec paths inside a tire category', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(
      filters({
        category: 'padangos',
        width: 205,
        aspectRatio: 55,
        season: 'winter',
        treadDepthMin: 5,
        yearMin: 2020,
        brand: 'Testlandia',
        // Rim-only values must be dropped rather than mistranslated.
        pcd: '5x112',
        material: 'alloy',
        etMin: 20,
      })
    );

    const query = fake.onlyQueryFor('listings');
    const triples = filterTriples(query);

    expect(triples).toContainEqual(['specs->width', 'eq', 205]);
    expect(triples).toContainEqual(['specs->aspect_ratio', 'eq', 55]);
    // Strings are JSON-quoted so the comparison happens against a JSON string.
    expect(triples).toContainEqual(['specs->season', 'eq', '"winter"']);
    expect(triples).toContainEqual(['specs->tread_depth', 'gte', 5]);
    expect(triples).toContainEqual(['specs->manufacturing_year', 'gte', 2020]);

    // Rim-only filters have no path in this category, so nothing is emitted.
    const paths = triples.map(([path]) => path);
    expect(paths).not.toContain('specs->pcd');
    expect(paths).not.toContain('specs->material');
    expect(paths).not.toContain('specs->et');

    // Brand is a case-insensitive text match on the ->> (text) path.
    const brandCall = callsOf(query, 'ilike').find(
      (call) => call.args[0] === 'specs->>brand'
    );
    expect(brandCall?.args[1]).toBe('%Testlandia%');
  });

  it('translates the same filters to nested paths for complete wheels', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(
      filters({
        category: 'komplektiniai_ratai',
        width: 225,
        pcd: '5x112',
        cb: 66.6,
        rimWidth: 8.5,
        etMin: 20,
        etMax: 45,
      })
    );

    const triples = filterTriples(fake.onlyQueryFor('listings'));

    expect(triples).toContainEqual(['specs->tire->width', 'eq', 225]);
    expect(triples).toContainEqual(['specs->rim->pcd', 'eq', '"5x112"']);
    expect(triples).toContainEqual(['specs->rim->cb', 'eq', 66.6]);
    expect(triples).toContainEqual(['specs->rim->rim_width', 'eq', 8.5]);
    expect(triples).toContainEqual(['specs->rim->et', 'gte', 20]);
    expect(triples).toContainEqual(['specs->rim->et', 'lte', 45]);
  });
});

/* -------------------------------------------------------------------------- */
/* fetchPublicListings — search                                                */
/* -------------------------------------------------------------------------- */

describe('fetchPublicListings free-text search', () => {
  it('turns a tire size into exact numeric filters inside a tire category', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(filters({ category: 'padangos', q: '205/55 R16' }));

    const query = fake.onlyQueryFor('listings');
    const triples = filterTriples(query);

    expect(triples).toContainEqual(['specs->width', 'eq', 205]);
    expect(triples).toContainEqual(['specs->aspect_ratio', 'eq', 55]);
    expect(triples).toContainEqual(['specs->diameter', 'eq', 16]);

    // A recognised size must not degrade into a LIKE scan.
    expect(callsOf(query, 'or')).toHaveLength(0);
    for (const call of callsOf(query, 'ilike')) {
      expect(String(call.args[1])).not.toContain('205');
    }
  });

  it('targets the nested tire half for a size typed in a complete-wheel category', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(
      filters({ category: 'komplektiniai_ratai', q: '225 45 17' })
    );

    const triples = filterTriples(fake.onlyQueryFor('listings'));

    expect(triples).toContainEqual(['specs->tire->width', 'eq', 225]);
    expect(triples).toContainEqual(['specs->tire->aspect_ratio', 'eq', 45]);
    expect(triples).toContainEqual(['specs->tire->diameter', 'eq', 17]);
  });

  it('falls back to an or(...) text expression for a non-size query', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(filters({ category: 'padangos', q: 'Testlandia' }));

    const query = fake.onlyQueryFor('listings');
    const expression = String(firstArgOf(query, 'or'));

    expect(callsOf(query, 'or')).toHaveLength(1);
    expect(expression).toContain('title.ilike.');
    expect(expression).toContain('specs->>brand.ilike.');
    expect(expression).toContain('Testlandia');

    // No exact spec filter was invented from a free-text query.
    expect(filterTriples(query)).toHaveLength(0);
  });

  it('falls back to text search for a size typed without a category', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(filters({ q: '205/55 R16' }));

    const query = fake.onlyQueryFor('listings');
    expect(callsOf(query, 'or')).toHaveLength(1);
    expect(filterTriples(query)).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* fetchPublicListings — sorting and pagination                                */
/* -------------------------------------------------------------------------- */

describe('fetchPublicListings sorting', () => {
  it('orders newest first by created_at descending', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(filters({ sort: 'newest' }));

    expect(at(orderPairs(fake.onlyQueryFor('listings')), 0)).toEqual([
      'created_at',
      false,
    ]);
  });

  it('orders by price ascending for the cheapest-first sort', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(filters({ sort: 'price_asc' }));

    expect(at(orderPairs(fake.onlyQueryFor('listings')), 0)).toEqual(['price', true]);
  });

  it('orders by price descending for the most-expensive-first sort', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    await fetchPublicListings(filters({ sort: 'price_desc' }));

    expect(at(orderPairs(fake.onlyQueryFor('listings')), 0)).toEqual(['price', false]);
  });

  it('always adds a stable tie-breaker on id as the last ordering', async () => {
    for (const sort of ['newest', 'price_asc', 'price_desc'] as const) {
      const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });
      await fetchPublicListings(filters({ sort }));

      const orders = orderPairs(fake.onlyQueryFor('listings'));
      expect(orders).toHaveLength(2);
      expect(at(orders, 1)).toEqual(['id', false]);
    }
  });
});

describe('fetchPublicListings pagination', () => {
  it('requests the second page as range(24, 47)', async () => {
    const fake = install({
      responses: {
        listings: [{ data: [rowWithImages(listingRow(), [])], count: 100 }],
      },
    });

    const result = await fetchPublicListings(filters({ page: 2 }));

    const rangeArgs = at(callsOf(fake.onlyQueryFor('listings'), 'range'), 0).args;
    expect(rangeArgs[0]).toBe(24);
    expect(rangeArgs[1]).toBe(47);
    expect(CATALOG_PAGE_SIZE).toBe(24);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.page).toBe(2);
    expect(result.data.pageSize).toBe(24);
    expect(result.data.total).toBe(100);
    expect(result.data.hasMore).toBe(true);
  });

  it('reports hasMore when the count exceeds the first page', async () => {
    install({
      responses: {
        listings: [{ data: [rowWithImages(listingRow(), [])], count: 49 }],
      },
    });

    const result = await fetchPublicListings(filters({ page: 1 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(true);
  });

  it('reports no more pages when the count fits exactly on one page', async () => {
    install({
      responses: {
        listings: [{ data: [rowWithImages(listingRow(), [])], count: 24 }],
      },
    });

    const result = await fetchPublicListings(filters({ page: 1 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
  });

  it('reports no more pages on the last page', async () => {
    install({
      responses: {
        listings: [{ data: [rowWithImages(listingRow(), [])], count: 30 }],
      },
    });

    const result = await fetchPublicListings(filters({ page: 2 }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.hasMore).toBe(false);
  });

  it('clamps a page below 1 to the first page', async () => {
    const fake = install({ responses: { listings: [{ data: [], count: 0 }] } });

    const result = await fetchPublicListings(filters({ page: 0 }));

    const rangeArgs = at(callsOf(fake.onlyQueryFor('listings'), 'range'), 0).args;
    expect(rangeArgs[0]).toBe(0);
    expect(rangeArgs[1]).toBe(23);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.page).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* fetchPublicListings — mapping and failures                                  */
/* -------------------------------------------------------------------------- */

describe('fetchPublicListings mapping', () => {
  it('returns images with the primary first and the rest by position', async () => {
    const images = [
      imageRow({ id: 'img-c', position: 3, is_primary: false }),
      imageRow({ id: 'img-a', position: 7, is_primary: true }),
      imageRow({ id: 'img-b', position: 1, is_primary: false }),
    ];

    install({
      responses: {
        listings: [{ data: [rowWithImages(listingRow(), images)], count: 1 }],
      },
    });

    const result = await fetchPublicListings(filters());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const listing = at(result.data.items, 0);
    expect(listing.images.map((image) => image.id)).toEqual([
      'img-a',
      'img-b',
      'img-c',
    ]);
    expect(at(listing.images, 0).is_primary).toBe(true);
  });

  it('skips a row whose specs do not match its category instead of failing', async () => {
    install({
      responses: {
        listings: [
          {
            data: [
              rowWithImages(listingRow(), []),
              rowWithImages(
                listingRow({ id: 'broken-row', specs: { brand: 'Testlandia' } }),
                []
              ),
            ],
            count: 2,
          },
        ],
      },
    });

    const result = await fetchPublicListings(filters());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(at(result.data.items, 0).id).toBe(listingRow().id);
  });

  it('never exposes a raw PostgREST message', async () => {
    install({ responses: { listings: [{ error: pgError('42P01', DB_LEAK) }] } });

    const result = await fetchPublicListings(filters());

    expectSafeFailure(result);
    if (result.ok) return;
    expect(result.error).toBe('unavailable');
  });

  it('maps known PostgREST codes onto the small error vocabulary', async () => {
    const cases = [
      ['42501', 'forbidden'],
      ['23505', 'conflict'],
      ['23514', 'validation'],
      ['22P02', 'validation'],
      ['PGRST116', 'not_found'],
      ['08006', 'unavailable'],
    ] as const;

    for (const [code, expected] of cases) {
      install({ responses: { listings: [{ error: pgError(code, DB_LEAK) }] } });

      const result = await fetchPublicListings(filters());

      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error).toBe(expected);
      expect(JSON.stringify(result)).not.toContain(DB_LEAK);
    }
  });

  it('returns unavailable when the client cannot even be created', async () => {
    holder.createClient = () =>
      Promise.reject(
        new Error('Missing environment variable NEXT_PUBLIC_SUPABASE_URL')
      );

    const result = await fetchPublicListings(filters());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('unavailable');
    expect(JSON.stringify(result)).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
  });
});

/* -------------------------------------------------------------------------- */
/* fetchListingBySlug                                                          */
/* -------------------------------------------------------------------------- */

describe('fetchListingBySlug', () => {
  it('returns not_found when no row matches', async () => {
    const fake = install({ responses: { listings: [{ data: null }] } });

    const result = await fetchListingBySlug('missing-slug-00000000');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');

    // The lookup is still scoped to the public visibility rules.
    const query = fake.onlyQueryFor('listings');
    expect(hasEq(query, 'slug', 'missing-slug-00000000')).toBe(true);
    expect(hasEq(query, 'status', 'active')).toBe(true);
    expect(hasEq(query, 'moderation_status', 'approved')).toBe(true);
    expect(callsOf(query, 'maybeSingle')).toHaveLength(1);
  });

  it('maps a row, its images and its seller into a domain listing', async () => {
    const row = listingRow();
    const images = [
      imageRow({ id: 'img-2', position: 5, is_primary: false }),
      imageRow({ id: 'img-1', position: 2, is_primary: true }),
    ];

    install({
      responses: {
        listings: [{ data: rowWithImages(row, images) }],
        listing_sellers: [
          {
            data: {
              listing_id: row.id,
              display_name: 'Testlandia Tyres',
              city: 'Vilnius',
              phone: '+370 600 00000',
            },
          },
        ],
      },
    });

    const result = await fetchListingBySlug(row.slug);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.listing.id).toBe(row.id);
    expect(result.data.listing.category).toBe('padangos');
    expect(result.data.listing.currency).toBe('EUR');
    expect(result.data.listing.specs).toMatchObject({
      brand: TIRE_SPECS.brand,
      width: TIRE_SPECS.width,
    });
    expect(result.data.listing.images.map((image) => image.id)).toEqual([
      'img-1',
      'img-2',
    ]);
    expect(result.data.seller.display_name).toBe('Testlandia Tyres');
    expect(result.data.seller.city).toBe('Vilnius');
    expect(result.data.seller.phone).toBe('+370 600 00000');
  });

  it('exposes only display_name, city and phone for the seller', async () => {
    const row = listingRow();

    const fake = install({
      responses: {
        listings: [{ data: rowWithImages(row, []) }],
        listing_sellers: [
          {
            data: {
              listing_id: row.id,
              display_name: 'Testlandia Tyres',
              city: 'Vilnius',
              phone: '+370 600 00000',
              // Anything extra the view might ever start returning must not
              // survive the mapper.
              email: 'leak@example.invalid',
              user_id: TEST_USER_ID,
            },
          },
        ],
      },
    });

    const result = await fetchListingBySlug(row.slug);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Object.keys(result.data.seller)).toEqual([
      'display_name',
      'city',
      'phone',
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('leak@example.invalid');
    expect(serialized).not.toContain('email');
    expect(serialized).not.toContain(TEST_USER_ID);
    expect(serialized).not.toContain('user_id');

    // The query itself asks for nothing more than those three columns.
    const sellerQuery = fake.onlyQueryFor('listing_sellers');
    const columns = String(firstArgOf(sellerQuery, 'select'));
    expect(columns).not.toContain('email');
    expect(columns).not.toContain('user_id');
    expect(hasEq(sellerQuery, 'listing_id', row.id)).toBe(true);
  });

  it('keeps the phone null when the seller kept it private', async () => {
    const row = listingRow();

    install({
      responses: {
        listings: [{ data: rowWithImages(row, []) }],
        listing_sellers: [
          {
            data: {
              listing_id: row.id,
              display_name: 'Testlandia Tyres',
              city: 'Vilnius',
              phone: null,
            },
          },
        ],
      },
    });

    const result = await fetchListingBySlug(row.slug);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.seller.phone).toBeNull();
    expect(Object.keys(result.data.seller)).toEqual([
      'display_name',
      'city',
      'phone',
    ]);
  });

  it('still returns a listing when the seller view has no row at all', async () => {
    const row = listingRow();

    install({
      responses: {
        listings: [{ data: rowWithImages(row, []) }],
        listing_sellers: [{ data: null }],
      },
    });

    const result = await fetchListingBySlug(row.slug);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.seller).toEqual({
      display_name: null,
      city: null,
      phone: null,
    });
  });

  it('never exposes a raw PostgREST message', async () => {
    install({ responses: { listings: [{ error: pgError('42P01', DB_LEAK) }] } });

    const result = await fetchListingBySlug('anything');

    expectSafeFailure(result);
  });
});

/* -------------------------------------------------------------------------- */
/* Owner-scoped reads                                                          */
/* -------------------------------------------------------------------------- */

describe('fetchOwnerListings', () => {
  it('always scopes the query to the user id it was given', async () => {
    const fake = install({
      responses: { listings: [{ data: [rowWithImages(listingRow(), [])] }] },
    });

    const result = await fetchOwnerListings(TEST_USER_ID);

    expect(result.ok).toBe(true);

    const query = fake.onlyQueryFor('listings');
    expect(hasEq(query, 'user_id', TEST_USER_ID)).toBe(true);
    expect(hasEq(query, 'user_id', OTHER_USER_ID)).toBe(false);
  });

  it('scopes to whichever id is passed, never a remembered one', async () => {
    const fake = install({ responses: { listings: [{ data: [] }] } });

    await fetchOwnerListings(OTHER_USER_ID);

    expect(hasEq(fake.onlyQueryFor('listings'), 'user_id', OTHER_USER_ID)).toBe(true);
  });

  it('never exposes a raw PostgREST message', async () => {
    install({ responses: { listings: [{ error: pgError('42501', DB_LEAK) }] } });

    const result = await fetchOwnerListings(TEST_USER_ID);

    expectSafeFailure(result);
    if (result.ok) return;
    expect(result.error).toBe('forbidden');
  });
});

describe('fetchOwnedListingById', () => {
  it('scopes by both the listing id and the user id', async () => {
    const fake = install({
      responses: { listings: [{ data: rowWithImages(listingRow(), []) }] },
    });

    const result = await fetchOwnedListingById(TEST_LISTING_ID, TEST_USER_ID);

    expect(result.ok).toBe(true);

    const pairs = eqPairs(fake.onlyQueryFor('listings'));
    expect(pairs).toContainEqual(['id', TEST_LISTING_ID]);
    expect(pairs).toContainEqual(['user_id', TEST_USER_ID]);
  });

  it('returns not_found rather than another owner’s row', async () => {
    const fake = install({ responses: { listings: [{ data: null }] } });

    const result = await fetchOwnedListingById(TEST_LISTING_ID, OTHER_USER_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
    expect(hasEq(fake.onlyQueryFor('listings'), 'user_id', OTHER_USER_ID)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function tireDraft(): ListingDraft {
  return {
    category: 'padangos',
    title: 'Testlandia Synthetic 1 205/55 R16',
    description: 'A fully synthetic listing used only by the automated tests.',
    condition: 'used',
    price: 120,
    quantity: 4,
    city: 'Vilnius',
    specs: { ...TIRE_SPECS },
  };
}

describe('createListing', () => {
  it('sends EUR, the session user id, the requested status and a valid slug', async () => {
    const fake = install({
      responses: {
        listings: [
          { data: { id: TEST_LISTING_ID, slug: 'generated-slug-abcd1234' } },
        ],
      },
    });

    // A draft that (maliciously or by accident) carries a user_id must not be
    // able to choose the owner of the row.
    const draft = {
      ...tireDraft(),
      user_id: OTHER_USER_ID,
    } as unknown as ListingDraft;

    const result = await createListing(draft, TEST_USER_ID, 'draft');

    expect(result.ok).toBe(true);

    const payload = insertPayload(fake.onlyQueryFor('listings'));
    expect(payload['currency']).toBe('EUR');
    expect(payload['user_id']).toBe(TEST_USER_ID);
    expect(payload['status']).toBe('draft');
    expect(payload['category']).toBe('padangos');
    expect(String(payload['slug'])).toMatch(SLUG_PATTERN);
  });

  it('publishes directly when the caller asks for the active status', async () => {
    const fake = install({
      responses: {
        listings: [
          { data: { id: TEST_LISTING_ID, slug: 'generated-slug-abcd1234' } },
        ],
      },
    });

    await createListing(tireDraft(), TEST_USER_ID, 'active');

    expect(insertPayload(fake.onlyQueryFor('listings'))['status']).toBe('active');
  });

  it('retries once with a different slug after a unique violation', async () => {
    const fake = install({
      responses: {
        listings: [
          {
            error: pgError(
              '23505',
              'duplicate key value violates unique constraint "listings_slug_key"'
            ),
          },
          { data: { id: TEST_LISTING_ID, slug: 'generated-slug-99887766' } },
        ],
      },
    });

    const result = await createListing(tireDraft(), TEST_USER_ID, 'draft');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(TEST_LISTING_ID);

    const attempts = fake.queriesFor('listings');
    expect(attempts).toHaveLength(2);

    const firstSlug = String(insertPayload(at(attempts, 0))['slug']);
    const secondSlug = String(insertPayload(at(attempts, 1))['slug']);

    expect(firstSlug).toMatch(SLUG_PATTERN);
    expect(secondSlug).toMatch(SLUG_PATTERN);
    expect(secondSlug).not.toBe(firstSlug);
  });

  it('gives up with a conflict after a second unique violation', async () => {
    const conflict = pgError(
      '23505',
      'duplicate key value violates unique constraint'
    );
    const fake = install({
      responses: { listings: [{ error: conflict }, { error: conflict }] },
    });

    const result = await createListing(tireDraft(), TEST_USER_ID, 'draft');

    expect(fake.queriesFor('listings')).toHaveLength(2);
    expectSafeFailure(result);
    if (result.ok) return;
    expect(result.error).toBe('conflict');
  });

  it('does not retry on an error that is not a unique violation', async () => {
    const fake = install({
      responses: { listings: [{ error: pgError('42501', DB_LEAK) }] },
    });

    const result = await createListing(tireDraft(), TEST_USER_ID, 'draft');

    expect(fake.queriesFor('listings')).toHaveLength(1);
    expectSafeFailure(result);
    if (result.ok) return;
    expect(result.error).toBe('forbidden');
  });
});

describe('updateListing', () => {
  it('scopes the update to the id and the owner', async () => {
    const fake = install({
      responses: { listings: [{ data: { slug: 'generated-slug-abcd1234' } }] },
    });

    const result = await updateListing(TEST_LISTING_ID, TEST_USER_ID, tireDraft());

    expect(result.ok).toBe(true);

    const query = fake.onlyQueryFor('listings');
    const pairs = eqPairs(query);
    expect(pairs).toContainEqual(['id', TEST_LISTING_ID]);
    expect(pairs).toContainEqual(['user_id', TEST_USER_ID]);

    // The update payload must not be able to move the row to another user or
    // rewrite its slug or its moderation state.
    const payload = at(callsOf(query, 'update'), 0).args[0];
    expect(payload).not.toHaveProperty('user_id');
    expect(payload).not.toHaveProperty('slug');
    expect(payload).not.toHaveProperty('moderation_status');
  });

  it('returns not_found when nothing matched the owner-scoped update', async () => {
    install({ responses: { listings: [{ data: null }] } });

    const result = await updateListing(TEST_LISTING_ID, OTHER_USER_ID, tireDraft());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });

  it('never exposes a raw PostgREST message', async () => {
    install({ responses: { listings: [{ error: pgError('42P01', DB_LEAK) }] } });

    const result = await updateListing(TEST_LISTING_ID, TEST_USER_ID, tireDraft());

    expectSafeFailure(result);
  });
});

describe('setListingStatus', () => {
  it('scopes the status change to the id and the owner', async () => {
    const fake = install({ responses: { listings: [{ count: 1 }] } });

    const result = await setListingStatus(TEST_LISTING_ID, TEST_USER_ID, 'sold');

    expect(result.ok).toBe(true);

    const query = fake.onlyQueryFor('listings');
    expect(at(callsOf(query, 'update'), 0).args[0]).toEqual({ status: 'sold' });

    const pairs = eqPairs(query);
    expect(pairs).toContainEqual(['id', TEST_LISTING_ID]);
    expect(pairs).toContainEqual(['user_id', TEST_USER_ID]);
  });

  it('returns not_found when the owner-scoped update matched no row', async () => {
    install({ responses: { listings: [{ count: 0 }] } });

    const result = await setListingStatus(TEST_LISTING_ID, OTHER_USER_ID, 'sold');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });
});

describe('deleteListing', () => {
  it('scopes the delete to the owner and returns the storage paths to clean up', async () => {
    const fake = install({
      responses: {
        listing_images: [
          {
            data: [
              { storage_path: `${TEST_USER_ID}/${TEST_LISTING_ID}/a.jpg` },
              { storage_path: `${TEST_USER_ID}/${TEST_LISTING_ID}/b.jpg` },
            ],
          },
        ],
        listings: [{ count: 1 }],
      },
    });

    const result = await deleteListing(TEST_LISTING_ID, TEST_USER_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      `${TEST_USER_ID}/${TEST_LISTING_ID}/a.jpg`,
      `${TEST_USER_ID}/${TEST_LISTING_ID}/b.jpg`,
    ]);

    const pairs = eqPairs(fake.onlyQueryFor('listings'));
    expect(pairs).toContainEqual(['id', TEST_LISTING_ID]);
    expect(pairs).toContainEqual(['user_id', TEST_USER_ID]);
  });

  it('returns not_found when the delete matched no row', async () => {
    install({
      responses: { listing_images: [{ data: [] }], listings: [{ count: 0 }] },
    });

    const result = await deleteListing(TEST_LISTING_ID, OTHER_USER_ID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });

  it('never exposes a raw PostgREST message', async () => {
    install({
      responses: {
        listing_images: [{ data: [] }],
        listings: [{ error: pgError('42501', DB_LEAK) }],
      },
    });

    const result = await deleteListing(TEST_LISTING_ID, TEST_USER_ID);

    expectSafeFailure(result);
  });
});

describe('fetchPublicSlugs', () => {
  /** The sitemap iterates the result, so it must always be a plain array. */
  function expectEmptyArray(result: unknown): void {
    expect(Array.isArray(result)).toBe(true);
    expect(result).not.toHaveProperty('ok');
    expect(result).toEqual([]);
  }

  it('returns [] when the Supabase client cannot be created', async () => {
    holder.createClient = () =>
      Promise.reject(new Error('Missing environment variable'));

    expectEmptyArray(await fetchPublicSlugs());
  });

  it('returns [] when the query fails', async () => {
    install({
      responses: { listings: [{ error: pgError('08006', DB_LEAK) }] },
    });

    expectEmptyArray(await fetchPublicSlugs());
  });

  it('returns [] when the query yields no data', async () => {
    install({ responses: { listings: [{ data: null }] } });

    expectEmptyArray(await fetchPublicSlugs());
  });

  it('returns slug and updated_at of public listings only', async () => {
    const rows = [
      { slug: 'michelin-205-55-r16-aaaa1111', updated_at: '2024-05-02T10:00:00.000Z' },
      { slug: 'bbs-18-5x112-bbbb2222', updated_at: '2024-05-01T10:00:00.000Z' },
    ];
    const fake = install({ responses: { listings: [{ data: rows }] } });

    const result = await fetchPublicSlugs();

    expect(Array.isArray(result)).toBe(true);
    expect(result).not.toHaveProperty('ok');
    expect(result).toEqual(rows);

    const query = fake.onlyQueryFor('listings');
    expect(firstArgOf(query, 'select')).toBe('slug, updated_at');
    expect(hasEq(query, 'status', 'active')).toBe(true);
    expect(hasEq(query, 'moderation_status', 'approved')).toBe(true);
  });
});
