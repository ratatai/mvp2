/**
 * Integration tests for src/lib/repositories/images.ts.
 *
 * The two invariants this module exists to protect are:
 *
 *   • metadata never exists without a Storage object — so a failed insert has
 *     to delete the objects that were just uploaded;
 *   • a Storage object never exists without metadata — so deleting an image
 *     removes the row and the object together.
 *
 * Both the query shapes and the Storage calls are recorded by the fake client,
 * which makes the rollback behaviour directly observable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_IMAGES_PER_LISTING } from '@/domain/listing.contract';

import {
  callsOf,
  createFakeSupabase,
  eqPairs,
  hasEq,
  pgError,
  type FakeSupabase,
  type FakeSupabaseOptions,
  type RecordedStorageCall,
} from './fake-supabase';
import { TEST_LISTING_ID, TEST_USER_ID, OTHER_USER_ID } from './fixtures';

/* -------------------------------------------------------------------------- */
/* Module mock                                                                 */
/* -------------------------------------------------------------------------- */

const holder = vi.hoisted(() => ({
  createClient: (): Promise<unknown> =>
    Promise.reject(new Error('the fake Supabase client was not installed')),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => holder.createClient(),
  getSessionUser: () => Promise.resolve(null),
}));

import {
  addImages,
  LISTING_IMAGES_BUCKET,
  removeImage,
  reorderImages,
  setPrimaryImage,
  type NewImageInput,
} from '@/lib/repositories/images';

/* -------------------------------------------------------------------------- */
/* Harness                                                                     */
/* -------------------------------------------------------------------------- */

function install(options: FakeSupabaseOptions = {}): FakeSupabase {
  const fake = createFakeSupabase(options);
  holder.createClient = () => Promise.resolve(fake.client);
  return fake;
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`expected an item at index ${index}, found none`);
  }
  return item;
}

/** A synthetic upload, already sitting in the bucket. */
function upload(name: string): NewImageInput {
  return {
    storagePath: `${TEST_USER_ID}/${TEST_LISTING_ID}/${name}.jpg`,
    publicUrl: `https://storage.example.test/${name}.jpg`,
  };
}

function removals(fake: FakeSupabase): readonly RecordedStorageCall[] {
  return fake.storageCalls.filter((call) => call.method === 'remove');
}

/** Every path passed to any `storage.remove(...)` call, flattened. */
function removedPaths(fake: FakeSupabase): readonly string[] {
  return removals(fake).flatMap((call) => {
    const paths = call.args[0];
    return Array.isArray(paths) ? paths.map((path) => String(path)) : [];
  });
}

/** The payload rows handed to `.insert(...)` on `listing_images`. */
function insertedRows(fake: FakeSupabase): readonly Record<string, unknown>[] {
  const queries = fake.queriesFor('listing_images');

  for (const query of queries) {
    const payload = callsOf(query, 'insert')[0]?.args[0];
    if (Array.isArray(payload)) {
      return payload.map((row) => row as Record<string, unknown>);
    }
  }

  return [];
}

/** The listing row returned by the ownership probe. */
const OWNED = { data: { id: TEST_LISTING_ID } };
const NOT_OWNED = { data: null };

function existingImage(
  id: string,
  position: number,
  isPrimary: boolean
): Record<string, unknown> {
  return { id, position, is_primary: isPrimary };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  holder.createClient = () =>
    Promise.reject(new Error('the fake Supabase client was not installed'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* addImages                                                                   */
/* -------------------------------------------------------------------------- */

describe('addImages', () => {
  it('does nothing at all for an empty batch', async () => {
    const fake = install();

    const result = await addImages(TEST_LISTING_ID, TEST_USER_ID, []);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
    expect(fake.queries).toHaveLength(0);
    expect(fake.storageCalls).toHaveLength(0);
  });

  it('makes the first image of an empty listing the primary one', async () => {
    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [
          { data: [] },
          {
            data: [
              {
                id: 'img-1',
                listing_id: TEST_LISTING_ID,
                storage_path: upload('one').storagePath,
                public_url: upload('one').publicUrl,
                position: 0,
                is_primary: true,
                created_at: '2026-01-02T10:00:00.000Z',
              },
              {
                id: 'img-2',
                listing_id: TEST_LISTING_ID,
                storage_path: upload('two').storagePath,
                public_url: upload('two').publicUrl,
                position: 1,
                is_primary: false,
                created_at: '2026-01-02T10:00:00.000Z',
              },
            ],
          },
        ],
      },
    });

    const result = await addImages(TEST_LISTING_ID, TEST_USER_ID, [
      upload('one'),
      upload('two'),
    ]);

    expect(result.ok).toBe(true);

    const rows = insertedRows(fake);
    expect(rows).toHaveLength(2);
    // Only the very first photo is promoted; nothing else is invented.
    expect(at(rows, 0)['is_primary']).toBe(true);
    expect(at(rows, 0)['position']).toBe(0);
    expect(at(rows, 1)['is_primary']).toBe(false);
    expect(at(rows, 1)['position']).toBe(1);

    // A successful insert must not touch Storage.
    expect(removals(fake)).toHaveLength(0);
  });

  it('does not steal the primary flag when the listing already has one', async () => {
    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [
          {
            data: [
              existingImage('img-old-a', 0, true),
              existingImage('img-old-b', 1, false),
            ],
          },
          { data: [] },
        ],
      },
    });

    await addImages(TEST_LISTING_ID, TEST_USER_ID, [upload('three')]);

    const rows = insertedRows(fake);
    expect(rows).toHaveLength(1);
    expect(at(rows, 0)['is_primary']).toBe(false);
    // Positions continue after the highest existing one.
    expect(at(rows, 0)['position']).toBe(2);
  });

  it('checks ownership before writing anything, and cleans up when it fails', async () => {
    const fake = install({ responses: { listings: [NOT_OWNED] } });

    const result = await addImages(TEST_LISTING_ID, OTHER_USER_ID, [
      upload('one'),
      upload('two'),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('forbidden');

    // The ownership probe is scoped to both the listing and the user.
    const probe = fake.onlyQueryFor('listings');
    const pairs = eqPairs(probe);
    expect(pairs).toContainEqual(['id', TEST_LISTING_ID]);
    expect(pairs).toContainEqual(['user_id', OTHER_USER_ID]);

    // No metadata was written…
    expect(fake.queriesFor('listing_images')).toHaveLength(0);
    // …and the orphaned objects were removed again.
    expect(removedPaths(fake)).toEqual([
      upload('one').storagePath,
      upload('two').storagePath,
    ]);
    expect(at(removals(fake), 0).bucket).toBe(LISTING_IMAGES_BUCKET);
  });

  it('rejects a batch that would exceed the ten-image limit', async () => {
    const existing = Array.from({ length: MAX_IMAGES_PER_LISTING - 1 }, (_, index) =>
      existingImage(`img-${index}`, index, index === 0)
    );

    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [{ data: existing }],
      },
    });

    const result = await addImages(TEST_LISTING_ID, TEST_USER_ID, [
      upload('ten'),
      upload('eleven'),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation');

    // Nothing was inserted…
    expect(insertedRows(fake)).toHaveLength(0);
    // …and both uploads were rolled back out of the bucket.
    expect(removedPaths(fake)).toEqual([
      upload('ten').storagePath,
      upload('eleven').storagePath,
    ]);
  });

  it('accepts a batch that lands exactly on the limit', async () => {
    const existing = Array.from({ length: MAX_IMAGES_PER_LISTING - 1 }, (_, index) =>
      existingImage(`img-${index}`, index, index === 0)
    );

    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [{ data: existing }, { data: [] }],
      },
    });

    const result = await addImages(TEST_LISTING_ID, TEST_USER_ID, [upload('ten')]);

    expect(result.ok).toBe(true);
    expect(insertedRows(fake)).toHaveLength(1);
    expect(removals(fake)).toHaveLength(0);
  });

  it('removes the uploaded objects again when the metadata insert fails', async () => {
    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [
          { data: [] },
          { error: pgError('23503', 'insert or update on table "listing_images" violates foreign key constraint') },
        ],
      },
    });

    const result = await addImages(TEST_LISTING_ID, TEST_USER_ID, [
      upload('one'),
      upload('two'),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('unavailable');

    // The rollback happened, against the right bucket, with every path.
    expect(removals(fake)).toHaveLength(1);
    expect(at(removals(fake), 0).bucket).toBe(LISTING_IMAGES_BUCKET);
    expect(removedPaths(fake)).toEqual([
      upload('one').storagePath,
      upload('two').storagePath,
    ]);

    // And the raw constraint message stayed inside the repository.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('foreign key');
    expect(serialized).not.toContain('listing_images');
  });

  it('returns the new images with the primary first and the rest by position', async () => {
    install({
      responses: {
        listings: [OWNED],
        listing_images: [
          { data: [] },
          {
            data: [
              {
                id: 'img-b',
                listing_id: TEST_LISTING_ID,
                storage_path: upload('b').storagePath,
                public_url: upload('b').publicUrl,
                position: 4,
                is_primary: false,
                created_at: '2026-01-02T10:00:00.000Z',
              },
              {
                id: 'img-a',
                listing_id: TEST_LISTING_ID,
                storage_path: upload('a').storagePath,
                public_url: upload('a').publicUrl,
                position: 9,
                is_primary: true,
                created_at: '2026-01-02T10:00:00.000Z',
              },
            ],
          },
        ],
      },
    });

    const result = await addImages(TEST_LISTING_ID, TEST_USER_ID, [
      upload('a'),
      upload('b'),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((image) => image.id)).toEqual(['img-a', 'img-b']);
  });
});

/* -------------------------------------------------------------------------- */
/* removeImage                                                                 */
/* -------------------------------------------------------------------------- */

describe('removeImage', () => {
  it('refuses to touch a listing the user does not own', async () => {
    const fake = install({ responses: { listings: [NOT_OWNED] } });

    const result = await removeImage(TEST_LISTING_ID, OTHER_USER_ID, 'img-1');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('forbidden');
    expect(fake.queriesFor('listing_images')).toHaveLength(0);
    expect(removals(fake)).toHaveLength(0);
  });

  it('deletes the row, then the object, and promotes the next photo', async () => {
    const storagePath = `${TEST_USER_ID}/${TEST_LISTING_ID}/gone.jpg`;

    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [
          // 1. look up the row being deleted
          { data: { storage_path: storagePath, is_primary: true } },
          // 2. the delete itself
          {},
          // 3. the remaining photos, to pick a new primary
          { data: [{ id: 'img-next' }] },
          // 4. the promotion
          {},
        ],
      },
    });

    const result = await removeImage(TEST_LISTING_ID, TEST_USER_ID, 'img-1');

    expect(result.ok).toBe(true);
    expect(removedPaths(fake)).toEqual([storagePath]);

    const queries = fake.queriesFor('listing_images');
    expect(queries).toHaveLength(4);

    // Every image query is scoped to the listing, never to an id alone.
    expect(hasEq(at(queries, 0), 'listing_id', TEST_LISTING_ID)).toBe(true);
    expect(hasEq(at(queries, 1), 'listing_id', TEST_LISTING_ID)).toBe(true);

    // The promotion sets is_primary on the next photo in position order.
    expect(at(callsOf(at(queries, 3), 'update'), 0).args[0]).toEqual({
      is_primary: true,
    });
    expect(hasEq(at(queries, 3), 'id', 'img-next')).toBe(true);
  });

  it('does not promote anything when the removed photo was not primary', async () => {
    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [
          { data: { storage_path: 'a/b/c.jpg', is_primary: false } },
          {},
        ],
      },
    });

    const result = await removeImage(TEST_LISTING_ID, TEST_USER_ID, 'img-1');

    expect(result.ok).toBe(true);
    expect(fake.queriesFor('listing_images')).toHaveLength(2);
  });

  it('returns not_found when the image does not belong to the listing', async () => {
    install({
      responses: { listings: [OWNED], listing_images: [{ data: null }] },
    });

    const result = await removeImage(TEST_LISTING_ID, TEST_USER_ID, 'img-missing');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });
});

/* -------------------------------------------------------------------------- */
/* setPrimaryImage                                                             */
/* -------------------------------------------------------------------------- */

describe('setPrimaryImage', () => {
  it('clears the previous primary before setting the new one', async () => {
    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [{}, { count: 1 }],
      },
    });

    const result = await setPrimaryImage(TEST_LISTING_ID, TEST_USER_ID, 'img-2');

    expect(result.ok).toBe(true);

    const queries = fake.queriesFor('listing_images');
    expect(queries).toHaveLength(2);

    expect(at(callsOf(at(queries, 0), 'update'), 0).args[0]).toEqual({
      is_primary: false,
    });
    expect(hasEq(at(queries, 0), 'listing_id', TEST_LISTING_ID)).toBe(true);
    expect(hasEq(at(queries, 0), 'is_primary', true)).toBe(true);

    expect(at(callsOf(at(queries, 1), 'update'), 0).args[0]).toEqual({
      is_primary: true,
    });
    expect(hasEq(at(queries, 1), 'id', 'img-2')).toBe(true);
    expect(hasEq(at(queries, 1), 'listing_id', TEST_LISTING_ID)).toBe(true);
  });

  it('returns not_found when the image is not in that listing', async () => {
    install({
      responses: { listings: [OWNED], listing_images: [{}, { count: 0 }] },
    });

    const result = await setPrimaryImage(TEST_LISTING_ID, TEST_USER_ID, 'img-x');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');
  });

  it('refuses when the user does not own the listing', async () => {
    const fake = install({ responses: { listings: [NOT_OWNED] } });

    const result = await setPrimaryImage(TEST_LISTING_ID, OTHER_USER_ID, 'img-2');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('forbidden');
    expect(fake.queriesFor('listing_images')).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* reorderImages                                                               */
/* -------------------------------------------------------------------------- */

describe('reorderImages', () => {
  it('rewrites positions, then moves the primary to the first image', async () => {
    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [{ count: 1 }, { count: 1 }, { count: 1 }, {}, {}],
      },
    });

    const result = await reorderImages(TEST_LISTING_ID, TEST_USER_ID, [
      'img-c',
      'img-a',
      'img-b',
    ]);

    expect(result.ok).toBe(true);

    // One position update per image, then clear-primary and set-primary.
    const queries = fake.queriesFor('listing_images');
    expect(queries).toHaveLength(5);

    const expected = [
      ['img-c', 0],
      ['img-a', 1],
      ['img-b', 2],
    ] as const;

    expected.forEach(([id, position], index) => {
      const query = at(queries, index);
      expect(at(callsOf(query, 'update'), 0).args[0]).toEqual({ position });
      expect(hasEq(query, 'id', id)).toBe(true);
      // Scoped to the listing, so an id from another listing cannot be moved.
      expect(hasEq(query, 'listing_id', TEST_LISTING_ID)).toBe(true);
    });

    // The old primary is cleared before the new one is set, so the partial
    // unique index never sees two primary rows for the listing.
    const clear = at(queries, 3);
    expect(at(callsOf(clear, 'update'), 0).args[0]).toEqual({ is_primary: false });
    expect(hasEq(clear, 'listing_id', TEST_LISTING_ID)).toBe(true);
    expect(hasEq(clear, 'is_primary', true)).toBe(true);

    const set = at(queries, 4);
    expect(at(callsOf(set, 'update'), 0).args[0]).toEqual({ is_primary: true });
    expect(hasEq(set, 'id', 'img-c')).toBe(true);
    expect(hasEq(set, 'listing_id', TEST_LISTING_ID)).toBe(true);
  });

  it('leaves the primary untouched when an id is not in the listing', async () => {
    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [{ count: 1 }, { count: 0 }],
      },
    });

    const result = await reorderImages(TEST_LISTING_ID, TEST_USER_ID, [
      'img-a',
      'img-stale',
      'img-b',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not_found');

    const queries = fake.queriesFor('listing_images');
    expect(queries).toHaveLength(2);

    const touchesPrimary = queries.some((query) =>
      callsOf(query, 'update').some((call) => 'is_primary' in Object(call.args[0]))
    );
    expect(touchesPrimary).toBe(false);
  });

  it('never sets a new primary when clearing the old one fails', async () => {
    const fake = install({
      responses: {
        listings: [OWNED],
        listing_images: [
          { count: 1 },
          { count: 1 },
          { error: pgError('08006', 'connection failure') },
        ],
      },
    });

    const result = await reorderImages(TEST_LISTING_ID, TEST_USER_ID, [
      'img-b',
      'img-a',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('unavailable');

    // Two position updates and the failed clear — no set-primary afterwards.
    expect(fake.queriesFor('listing_images')).toHaveLength(3);
  });

  it('rejects a sequence longer than the image limit', async () => {
    const fake = install({ responses: { listings: [OWNED] } });

    const tooMany = Array.from(
      { length: MAX_IMAGES_PER_LISTING + 1 },
      (_, index) => `img-${index}`
    );

    const result = await reorderImages(TEST_LISTING_ID, TEST_USER_ID, tooMany);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('validation');
    expect(fake.queriesFor('listing_images')).toHaveLength(0);
  });

  it('refuses when the user does not own the listing', async () => {
    const fake = install({ responses: { listings: [NOT_OWNED] } });

    const result = await reorderImages(TEST_LISTING_ID, OTHER_USER_ID, ['img-a']);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('forbidden');
    expect(fake.queriesFor('listing_images')).toHaveLength(0);
  });
});
