/**
 * Row fixtures for the repository integration tests.
 *
 * The rows are shaped exactly like the database returns them (see
 * src/lib/supabase/database.types.ts) and are valid against the domain
 * schemas, so the mapper accepts them. Every value here is obviously
 * synthetic: no real person, address, phone number or email appears.
 */

import type { ListingImageRow, ListingRow } from '@/lib/supabase/database.types';

export const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
export const TEST_LISTING_ID = '33333333-3333-4333-8333-333333333333';

export const TIRE_SPECS = {
  brand: 'Testlandia',
  model: 'Synthetic 1',
  width: 205,
  aspect_ratio: 55,
  diameter: 16,
  season: 'summer',
} as const;

export const RIM_SPECS = {
  brand: 'Testlandia',
  diameter: 18,
  rim_width: 8.5,
  bolt_count: 5,
  pcd: '5x112',
  cb: 66.6,
  et: 35,
  material: 'alloy',
} as const;

export const WHEEL_SPECS = {
  rim: RIM_SPECS,
  tire: { ...TIRE_SPECS, diameter: 18 },
} as const;

/** A public, approved tire listing row. Override anything per test. */
export function listingRow(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: TEST_LISTING_ID,
    user_id: TEST_USER_ID,
    category: 'padangos',
    title: 'Testlandia Synthetic 1 205/55 R16',
    description: 'A fully synthetic listing used only by the automated tests.',
    condition: 'used',
    price: 120,
    currency: 'EUR',
    quantity: 4,
    country: 'LT',
    city: 'Vilnius',
    area: null,
    specs: { ...TIRE_SPECS },
    status: 'active',
    moderation_status: 'approved',
    slug: 'testlandia-synthetic-1-205-55-r16-abcd1234',
    created_at: '2026-01-02T10:00:00.000Z',
    updated_at: '2026-01-02T10:00:00.000Z',
    published_at: '2026-01-02T10:00:00.000Z',
    ...overrides,
  };
}

export function imageRow(
  overrides: Partial<ListingImageRow> & Pick<ListingImageRow, 'id'>
): ListingImageRow {
  return {
    listing_id: TEST_LISTING_ID,
    storage_path: `${TEST_USER_ID}/${TEST_LISTING_ID}/${overrides.id}.jpg`,
    public_url: `https://storage.example.test/${overrides.id}.jpg`,
    position: 0,
    is_primary: false,
    created_at: '2026-01-02T10:00:00.000Z',
    ...overrides,
  };
}

/** A listing row as the catalog query returns it: with its images embedded. */
export function rowWithImages(
  row: ListingRow,
  images: readonly ListingImageRow[]
): Record<string, unknown> {
  return { ...row, listing_images: [...images] };
}
