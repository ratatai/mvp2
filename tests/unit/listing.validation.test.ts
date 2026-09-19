import { describe, it, expect } from 'vitest';

import {
  formatTireSize,
  parseListingDraft,
  parsePcd,
  parseSpecsForCategory,
  rimSpecsSchema,
  tireSpecsSchema,
  wheelSpecsSchema,
} from '@/domain/listing.validation';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const validTire = {
  brand: 'Michelin',
  width: 205,
  aspect_ratio: 55,
  diameter: 16,
  season: 'summer',
};

const validRim = {
  brand: 'BBS',
  diameter: 18,
  rim_width: 8.5,
  bolt_count: 5,
  pcd: '5x112',
  cb: 66.6,
  et: 35,
  material: 'alloy',
};

const validWheel = {
  rim: { ...validRim, diameter: 18 },
  tire: { ...validTire, diameter: 18 },
};

/* -------------------------------------------------------------------------- */
/* parsePcd                                                                    */
/* -------------------------------------------------------------------------- */

describe('parsePcd', () => {
  it('accepts the canonical PCD forms', () => {
    expect(parsePcd('4x100')).toEqual({ boltCount: 4, circleDiameter: 100 });
    expect(parsePcd('5x112')).toEqual({ boltCount: 5, circleDiameter: 112 });
    expect(parsePcd('5x114.3')).toEqual({ boltCount: 5, circleDiameter: 114.3 });
  });

  it('rejects malformed, zero and negative PCD strings', () => {
    expect(parsePcd('5x')).toBeNull();
    expect(parsePcd('x112')).toBeNull();
    expect(parsePcd('5x11.4.3')).toBeNull();
    expect(parsePcd('0x100')).toBeNull();
    expect(parsePcd('-5x112')).toBeNull();
    expect(parsePcd('5x0')).toBeNull();
    expect(parsePcd('')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(parsePcd(undefined)).toBeNull();
    expect(parsePcd(null)).toBeNull();
    expect(parsePcd(5112)).toBeNull();
    expect(parsePcd({ boltCount: 5, circleDiameter: 112 })).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Tires                                                                       */
/* -------------------------------------------------------------------------- */

describe('tireSpecsSchema', () => {
  it('accepts a valid tire', () => {
    const result = tireSpecsSchema.safeParse({
      ...validTire,
      model: 'Primacy 4',
      tread_depth: 7.5,
      manufacturing_year: 2021,
      dot: '3021',
      load_index: 91,
      speed_index: 'V',
      xl: true,
      run_flat: false,
      studded: false,
      sale_unit: 'set',
      defects: 'Nedidelis įbrėžimas',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brand).toBe('Michelin');
      expect(result.data.season).toBe('summer');
    }
  });

  it('rejects an invalid season', () => {
    expect(tireSpecsSchema.safeParse({ ...validTire, season: 'ruduo' }).success).toBe(false);
    expect(tireSpecsSchema.safeParse({ ...validTire, season: 'vasara' }).success).toBe(false);
  });

  it('rejects a missing required field', () => {
    const { brand: _brand, ...noBrand } = validTire;
    const { width: _width, ...noWidth } = validTire;
    const { aspect_ratio: _aspect, ...noAspect } = validTire;
    const { diameter: _diameter, ...noDiameter } = validTire;

    expect(tireSpecsSchema.safeParse(noBrand).success).toBe(false);
    expect(tireSpecsSchema.safeParse(noWidth).success).toBe(false);
    expect(tireSpecsSchema.safeParse(noAspect).success).toBe(false);
    expect(tireSpecsSchema.safeParse(noDiameter).success).toBe(false);
  });

  it('rejects a string where a number is required', () => {
    expect(tireSpecsSchema.safeParse({ ...validTire, width: '205' }).success).toBe(false);
    expect(tireSpecsSchema.safeParse({ ...validTire, diameter: '16' }).success).toBe(false);
  });

  it('rejects unknown extra keys', () => {
    expect(
      tireSpecsSchema.safeParse({ ...validTire, centerBore: 66.6 }).success
    ).toBe(false);
    expect(tireSpecsSchema.safeParse({ ...validTire, pcd: '5x112' }).success).toBe(false);
  });

  it('accepts wide section tires (355 and 375 are real sizes)', () => {
    const wide = tireSpecsSchema.safeParse({ ...validTire, width: 355, aspect_ratio: 25, diameter: 21 });
    const wider = tireSpecsSchema.safeParse({ ...validTire, width: 375, aspect_ratio: 25, diameter: 21 });

    expect(wide.success).toBe(true);
    expect(wider.success).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Rims                                                                        */
/* -------------------------------------------------------------------------- */

describe('rimSpecsSchema', () => {
  it('accepts a valid rim', () => {
    const result = rimSpecsSchema.safeParse(validRim);
    expect(result.success).toBe(true);
  });

  it('rejects a bolt_count that disagrees with the PCD', () => {
    const result = rimSpecsSchema.safeParse({ ...validRim, bolt_count: 4, pcd: '5x112' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('bolt_count_pcd_mismatch');
    }
  });

  it('accepts a bolt_count that agrees with the PCD', () => {
    expect(
      rimSpecsSchema.safeParse({ ...validRim, bolt_count: 4, pcd: '4x100' }).success
    ).toBe(true);
  });

  it('rejects an invalid material', () => {
    expect(rimSpecsSchema.safeParse({ ...validRim, material: 'wood' }).success).toBe(false);
    expect(rimSpecsSchema.safeParse({ ...validRim, material: 'lydinys' }).success).toBe(false);
  });

  it('rejects an invalid PCD string', () => {
    expect(rimSpecsSchema.safeParse({ ...validRim, pcd: '5x' }).success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Complete wheels                                                             */
/* -------------------------------------------------------------------------- */

describe('wheelSpecsSchema', () => {
  it('accepts a complete wheel whose rim and tire diameters match', () => {
    const result = wheelSpecsSchema.safeParse(validWheel);
    expect(result.success).toBe(true);
  });

  it('accepts a complete wheel that also carries per-half conditions', () => {
    const result = wheelSpecsSchema.safeParse({
      rim: { ...validRim, diameter: 18, condition: 'used' },
      tire: { ...validTire, diameter: 18, condition: 'new' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a complete wheel whose rim and tire diameters disagree', () => {
    const result = wheelSpecsSchema.safeParse({
      rim: { ...validRim, diameter: 18 },
      tire: { ...validTire, diameter: 17 },
    });
    expect(result.success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Cross-category confusion                                                    */
/* -------------------------------------------------------------------------- */

describe('cross-category confusion', () => {
  it('never accepts tire specs as rim specs', () => {
    expect(rimSpecsSchema.safeParse(validTire).success).toBe(false);
  });

  it('never accepts rim specs as tire specs', () => {
    expect(tireSpecsSchema.safeParse(validRim).success).toBe(false);
  });

  it('never accepts flat tire or rim specs as a complete wheel', () => {
    expect(wheelSpecsSchema.safeParse(validTire).success).toBe(false);
    expect(wheelSpecsSchema.safeParse(validRim).success).toBe(false);
  });

  it('never accepts a complete wheel as flat tire or rim specs', () => {
    expect(tireSpecsSchema.safeParse(validWheel).success).toBe(false);
    expect(rimSpecsSchema.safeParse(validWheel).success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* parseSpecsForCategory                                                       */
/* -------------------------------------------------------------------------- */

describe('parseSpecsForCategory', () => {
  it('validates each category against its own schema', () => {
    const tire = parseSpecsForCategory('padangos', validTire);
    expect(tire.ok).toBe(true);

    const rim = parseSpecsForCategory('ratlankiai', validRim);
    expect(rim.ok).toBe(true);

    const wheel = parseSpecsForCategory('komplektiniai_ratai', validWheel);
    expect(wheel.ok).toBe(true);
  });

  it('rejects specs belonging to a different category', () => {
    expect(parseSpecsForCategory('padangos', validRim).ok).toBe(false);
    expect(parseSpecsForCategory('ratlankiai', validTire).ok).toBe(false);
    expect(parseSpecsForCategory('komplektiniai_ratai', validTire).ok).toBe(false);
  });

  it('never throws for junk input and always explains itself', () => {
    const junk: readonly unknown[] = [
      null,
      undefined,
      42,
      'padangos',
      [],
      [validTire],
      {},
      { brand: 'Michelin', width: 205 },
      { ...validTire, ...validRim },
    ];

    for (const input of junk) {
      expect(() => parseSpecsForCategory('padangos', input)).not.toThrow();

      const result = parseSpecsForCategory('padangos', input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.length).toBeGreaterThan(0);
      }
    }
  });

  it('reports a non-object as such instead of crashing', () => {
    const result = parseSpecsForCategory('ratlankiai', 'not an object');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(['specs: not_an_object']);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* parseListingDraft                                                           */
/* -------------------------------------------------------------------------- */

const validDraft = {
  category: 'padangos',
  title: 'Michelin Primacy 4 205/55 R16',
  description: 'Keturios vasarinės padangos, protektorius 7 mm, be defektų.',
  condition: 'used',
  price: 120,
  quantity: 4,
  city: 'Vilnius',
  specs: validTire,
};

describe('parseListingDraft', () => {
  it('accepts a valid draft', () => {
    const result = parseListingDraft(validDraft);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.category).toBe('padangos');
      expect(result.draft.price).toBe(120);
      expect(result.draft.quantity).toBe(4);
      expect(result.draft.city).toBe('Vilnius');
    }
  });

  it('rejects a negative price', () => {
    expect(parseListingDraft({ ...validDraft, price: -1 }).ok).toBe(false);
  });

  it('rejects a zero, negative or fractional quantity', () => {
    expect(parseListingDraft({ ...validDraft, quantity: 0 }).ok).toBe(false);
    expect(parseListingDraft({ ...validDraft, quantity: -2 }).ok).toBe(false);
    expect(parseListingDraft({ ...validDraft, quantity: 2.5 }).ok).toBe(false);
  });

  it('rejects an empty title', () => {
    expect(parseListingDraft({ ...validDraft, title: '' }).ok).toBe(false);
    expect(parseListingDraft({ ...validDraft, title: '   ' }).ok).toBe(false);
  });

  it('rejects a too short description', () => {
    expect(parseListingDraft({ ...validDraft, description: 'Trumpa' }).ok).toBe(false);
  });

  it('never defaults an omitted optional spec field', () => {
    const result = parseListingDraft(validDraft);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const keys = Object.keys(result.draft.specs);
      expect(keys).not.toContain('model');
      expect(keys).not.toContain('manufacturing_year');
      expect(keys).not.toContain('tread_depth');
      expect(keys).not.toContain('sale_unit');
      expect('model' in result.draft.specs).toBe(false);
    }
  });

  it('never defaults an omitted optional core field', () => {
    const result = parseListingDraft(validDraft);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.draft)).not.toContain('area');
    }
  });

  it('keeps an area that was supplied', () => {
    const result = parseListingDraft({ ...validDraft, area: 'Naujamiestis' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.area).toBe('Naujamiestis');
    }
  });

  it('never throws for junk input', () => {
    expect(() => parseListingDraft(null)).not.toThrow();
    expect(() => parseListingDraft('draft')).not.toThrow();
    expect(() => parseListingDraft([])).not.toThrow();
    expect(parseListingDraft(undefined).ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Derived formatting                                                          */
/* -------------------------------------------------------------------------- */

describe('formatTireSize', () => {
  it('builds the printed size from the structured fields', () => {
    expect(formatTireSize({ width: 205, aspect_ratio: 55, diameter: 16 })).toBe('205/55 R16');
  });
});
