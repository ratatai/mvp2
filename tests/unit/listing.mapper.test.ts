import { describe, it, expect } from 'vitest';

import type { ListingDraft, ListingImage } from '@/domain/listing.contract';
import {
  draftToInsert,
  primaryImageOf,
  rowsToListings,
  rowToListing,
  rowToPublicSeller,
  sortImages,
} from '@/domain/listing.mapper';
import type {
  Json,
  ListingImageRow,
  ListingRow,
  ListingSellerRow,
} from '@/lib/supabase/database.types';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const tireSpecsJson: Json = {
  brand: 'Michelin',
  width: 205,
  aspect_ratio: 55,
  diameter: 16,
  season: 'summer',
};

function makeRow(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: '22222222-2222-2222-2222-222222222222',
    category: 'padangos',
    title: 'Michelin Primacy 4 205/55 R16',
    description: 'Keturios vasarinės padangos, protektorius 7 mm.',
    condition: 'used',
    price: 120,
    currency: 'EUR',
    quantity: 4,
    country: 'LT',
    city: 'Vilnius',
    area: null,
    specs: tireSpecsJson,
    status: 'active',
    moderation_status: 'approved',
    slug: 'michelin-primacy-4-205-55-r16-abcd1234',
    created_at: '2024-05-01T10:00:00.000Z',
    updated_at: '2024-05-02T10:00:00.000Z',
    published_at: '2024-05-01T12:00:00.000Z',
    ...overrides,
  };
}

function makeImageRow(overrides: Partial<ListingImageRow> = {}): ListingImageRow {
  return {
    id: 'image-1',
    listing_id: '11111111-1111-1111-1111-111111111111',
    storage_path: 'listings/1/a.jpg',
    public_url: 'https://cdn.example.com/listings/1/a.jpg',
    position: 0,
    is_primary: false,
    created_at: '2024-05-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeImage(overrides: Partial<ListingImage> = {}): ListingImage {
  return {
    id: 'image-1',
    storage_path: 'listings/1/a.jpg',
    public_url: 'https://cdn.example.com/listings/1/a.jpg',
    position: 0,
    is_primary: false,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

describe('sortImages', () => {
  it('puts the primary image first and then orders by ascending position', () => {
    const images = [
      makeImage({ id: 'c', position: 2 }),
      makeImage({ id: 'p', position: 5, is_primary: true }),
      makeImage({ id: 'a', position: 0 }),
      makeImage({ id: 'b', position: 1 }),
    ];

    const sorted = sortImages(images);

    expect(sorted.map((image) => image.id)).toEqual(['p', 'a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const images = [
      makeImage({ id: 'a', position: 1 }),
      makeImage({ id: 'p', position: 9, is_primary: true }),
    ];

    sortImages(images);

    expect(images.map((image) => image.id)).toEqual(['a', 'p']);
  });
});

describe('primaryImageOf', () => {
  it('returns the image flagged primary', () => {
    const images = [
      makeImage({ id: 'a', position: 0 }),
      makeImage({ id: 'p', position: 7, is_primary: true }),
    ];

    expect(primaryImageOf(images)?.id).toBe('p');
  });

  it('falls back to the first image by position when nothing is flagged primary', () => {
    const images = [
      makeImage({ id: 'second', position: 3 }),
      makeImage({ id: 'first', position: 1 }),
    ];

    expect(primaryImageOf(images)?.id).toBe('first');
  });

  it('returns null for an empty list', () => {
    expect(primaryImageOf([])).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* rowToListing                                                                */
/* -------------------------------------------------------------------------- */

describe('rowToListing', () => {
  it('maps a valid row plus its image rows into a domain listing', () => {
    const row = makeRow();
    const imageRows = [
      makeImageRow({ id: 'second', position: 3 }),
      makeImageRow({ id: 'primary', position: 8, is_primary: true }),
      makeImageRow({ id: 'first', position: 1 }),
    ];

    const result = rowToListing(row, imageRows);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const { listing } = result;
      expect(listing.id).toBe(row.id);
      expect(listing.slug).toBe(row.slug);
      expect(listing.title).toBe(row.title);
      expect(listing.category).toBe('padangos');
      expect(listing.condition).toBe('used');
      expect(listing.price).toBe(120);
      expect(listing.currency).toBe('EUR');
      expect(listing.quantity).toBe(4);
      expect(listing.country).toBe('LT');
      expect(listing.area).toBeNull();
      expect(listing.status).toBe('active');
      expect(listing.moderation_status).toBe('approved');
      expect(listing.published_at).toBe(row.published_at);
      expect(listing.specs).toEqual({
        brand: 'Michelin',
        width: 205,
        aspect_ratio: 55,
        diameter: 16,
        season: 'summer',
      });
      expect(listing.images.map((image) => image.id)).toEqual([
        'primary',
        'first',
        'second',
      ]);
    }
  });

  it('round trips the fields produced by draftToInsert', () => {
    const draft: ListingDraft<'padangos'> = {
      category: 'padangos',
      title: 'Michelin Primacy 4 205/55 R16',
      description: 'Keturios vasarinės padangos, protektorius 7 mm.',
      condition: 'used',
      price: 120.5,
      quantity: 4,
      city: 'Kaunas',
      area: 'Žaliakalnis',
      specs: {
        brand: 'Michelin',
        model: 'Primacy 4',
        width: 205,
        aspect_ratio: 55,
        diameter: 16,
        season: 'summer',
        tread_depth: 7,
      },
    };

    const insert = draftToInsert(draft, {
      userId: '22222222-2222-2222-2222-222222222222',
      slug: 'michelin-primacy-4-205-55-r16-abcd1234',
      status: 'active',
    });

    const row: ListingRow = {
      id: '11111111-1111-1111-1111-111111111111',
      user_id: insert.user_id,
      category: insert.category,
      title: insert.title,
      description: insert.description,
      condition: insert.condition,
      price: insert.price,
      currency: insert.currency ?? 'EUR',
      quantity: insert.quantity,
      country: insert.country ?? 'LT',
      city: insert.city,
      area: insert.area ?? null,
      specs: insert.specs,
      status: insert.status ?? 'active',
      moderation_status: 'approved',
      slug: insert.slug,
      created_at: '2024-05-01T10:00:00.000Z',
      updated_at: '2024-05-01T10:00:00.000Z',
      published_at: '2024-05-01T10:00:00.000Z',
    };

    const result = rowToListing(row);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const { listing } = result;
      expect(listing.category).toBe(draft.category);
      expect(listing.title).toBe(draft.title);
      expect(listing.description).toBe(draft.description);
      expect(listing.condition).toBe(draft.condition);
      expect(listing.price).toBe(draft.price);
      expect(listing.quantity).toBe(draft.quantity);
      expect(listing.city).toBe(draft.city);
      expect(listing.area).toBe('Žaliakalnis');
      expect(listing.currency).toBe('EUR');
      expect(listing.specs).toEqual(draft.specs);
    }
  });

  it('rejects an unknown category without throwing', () => {
    const row = makeRow({ category: 'akumuliatoriai' });

    expect(() => rowToListing(row)).not.toThrow();

    const result = rowToListing(row);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unknown_category:akumuliatoriai');
    }
  });

  it('rejects an unknown condition without throwing', () => {
    const result = rowToListing(makeRow({ condition: 'restored' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unknown_condition:restored');
    }
  });

  it('rejects an unknown status without throwing', () => {
    const result = rowToListing(makeRow({ status: 'published' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unknown_status:published');
    }
  });

  it('rejects an unknown moderation status without throwing', () => {
    const result = rowToListing(makeRow({ moderation_status: 'ok' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unknown_moderation_status:ok');
    }
  });

  it('rejects an unsupported currency without throwing', () => {
    const result = rowToListing(makeRow({ currency: 'USD' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('unsupported_currency:USD');
    }
  });

  it('rejects specs that are not an object without throwing', () => {
    const nonObjectSpecs: readonly Json[] = [
      'not an object',
      42,
      null,
      [tireSpecsJson],
      true,
    ];

    for (const specs of nonObjectSpecs) {
      const row = makeRow({ specs });

      expect(() => rowToListing(row)).not.toThrow();

      const result = rowToListing(row);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('specs_not_an_object');
      }
    }
  });

  it('rejects specs that do not match their category without throwing', () => {
    const row = makeRow({
      category: 'ratlankiai',
      specs: tireSpecsJson,
    });

    expect(() => rowToListing(row)).not.toThrow();

    const result = rowToListing(row);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.startsWith('invalid_specs:')).toBe(true);
    }
  });

  it('rejects a half filled specs blob without throwing', () => {
    const result = rowToListing(makeRow({ specs: { brand: 'Michelin', width: 205 } }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.startsWith('invalid_specs:')).toBe(true);
    }
  });

  it('converts a legacy "ratai" row with centerBore/offset keys', () => {
    const row = makeRow({
      category: 'ratai',
      condition: 'naudotas',
      specs: {
        rim: {
          brand: 'BBS',
          diameter: 18,
          rimWidth: 8.5,
          boltCount: 5,
          pcd: '5x112',
          centerBore: 66.6,
          offset: 35,
          material: 'alloy',
        },
        tire: {
          brand: 'Michelin',
          width: 225,
          aspectRatio: 45,
          diameter: 18,
          season: 'vasara',
        },
      },
    });

    const result = rowToListing(row);

    expect(result.ok).toBe(true);
    if (result.ok && result.listing.category === 'komplektiniai_ratai') {
      const { specs } = result.listing;
      expect(result.listing.category).toBe('komplektiniai_ratai');
      expect(result.listing.condition).toBe('used');
      expect(specs.rim.cb).toBe(66.6);
      expect(specs.rim.et).toBe(35);
      expect(specs.rim.rim_width).toBe(8.5);
      expect(specs.rim.bolt_count).toBe(5);
      expect('centerBore' in specs.rim).toBe(false);
      expect('offset' in specs.rim).toBe(false);
      expect(specs.tire.aspect_ratio).toBe(45);
    }
  });

  it('converts a legacy "wheels" row with centerBore/offset keys into rim specs', () => {
    const row = makeRow({
      category: 'wheels',
      specs: {
        brand: 'BBS',
        diameter: 18,
        rimWidth: 8.5,
        boltCount: 5,
        pcd: '5x112',
        centerBore: 66.6,
        offset: 35,
        material: 'alloy',
      },
    });

    const result = rowToListing(row);

    expect(result.ok).toBe(true);
    if (result.ok && result.listing.category === 'ratlankiai') {
      expect(result.listing.specs.cb).toBe(66.6);
      expect(result.listing.specs.et).toBe(35);
      expect(Object.keys(result.listing.specs)).not.toContain('centerBore');
      expect(Object.keys(result.listing.specs)).not.toContain('offset');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* rowsToListings                                                              */
/* -------------------------------------------------------------------------- */

describe('rowsToListings', () => {
  it('drops invalid rows, keeps valid ones and reports the rejections', () => {
    const good = makeRow({ id: 'good-1' });
    const badCategory = makeRow({ id: 'bad-1', category: 'akumuliatoriai' });
    const badSpecs = makeRow({ id: 'bad-2', specs: 'nope' });

    const images = new Map<string, readonly ListingImageRow[]>([
      ['good-1', [makeImageRow({ id: 'img', listing_id: 'good-1' })]],
    ]);

    expect(() => rowsToListings([good, badCategory, badSpecs], images)).not.toThrow();

    const { listings, rejected } = rowsToListings([good, badCategory, badSpecs], images);

    expect(listings).toHaveLength(1);
    expect(listings[0]?.id).toBe('good-1');
    expect(listings[0]?.images.map((image) => image.id)).toEqual(['img']);

    expect(rejected).toHaveLength(2);
    expect(rejected[0]).toBe('bad-1:unknown_category:akumuliatoriai');
    expect(rejected[1]).toBe('bad-2:specs_not_an_object');
  });

  it('returns empty collections for an empty page', () => {
    const { listings, rejected } = rowsToListings(
      [],
      new Map<string, readonly ListingImageRow[]>()
    );

    expect(listings).toEqual([]);
    expect(rejected).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Seller                                                                      */
/* -------------------------------------------------------------------------- */

describe('rowToPublicSeller', () => {
  it('keeps a null phone null', () => {
    const row: ListingSellerRow = {
      listing_id: '11111111-1111-1111-1111-111111111111',
      display_name: 'Jonas',
      city: 'Vilnius',
      phone: null,
    };

    const seller = rowToPublicSeller(row);

    expect(seller.phone).toBeNull();
    expect(seller.display_name).toBe('Jonas');
    expect(seller.city).toBe('Vilnius');
  });

  it('never exposes an id or an email key', () => {
    const row: ListingSellerRow = {
      listing_id: '11111111-1111-1111-1111-111111111111',
      display_name: 'Jonas',
      city: 'Vilnius',
      phone: '+37060000000',
    };

    const keys = Object.keys(rowToPublicSeller(row)).sort();

    expect(keys).toEqual(['city', 'display_name', 'phone']);
    expect(keys).not.toContain('id');
    expect(keys).not.toContain('listing_id');
    expect(keys).not.toContain('email');
  });

  it('returns an all null seller when the view gave no row', () => {
    const seller = rowToPublicSeller(null);

    expect(seller).toEqual({ display_name: null, city: null, phone: null });
  });
});

/* -------------------------------------------------------------------------- */
/* draftToInsert                                                               */
/* -------------------------------------------------------------------------- */

describe('draftToInsert', () => {
  it('always sets EUR and takes the user id from the caller, never from the draft', () => {
    const draft: ListingDraft<'padangos'> = {
      category: 'padangos',
      title: 'Michelin Primacy 4 205/55 R16',
      description: 'Keturios vasarinės padangos, protektorius 7 mm.',
      condition: 'used',
      price: 120,
      quantity: 4,
      city: 'Vilnius',
      specs: {
        brand: 'Michelin',
        width: 205,
        aspect_ratio: 55,
        diameter: 16,
        season: 'summer',
      },
    };

    const draftWithForgedUser = {
      ...draft,
      user_id: 'attacker',
      currency: 'USD',
    } as ListingDraft<'padangos'>;

    const insert = draftToInsert(draftWithForgedUser, {
      userId: 'session-user',
      slug: 'a-slug-abcd1234',
      status: 'draft',
    });

    expect(insert.currency).toBe('EUR');
    expect(insert.user_id).toBe('session-user');
    expect(insert.status).toBe('draft');
    expect(insert.slug).toBe('a-slug-abcd1234');
    expect(insert.area).toBeNull();
  });
});
