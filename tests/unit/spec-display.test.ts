import { describe, it, expect } from 'vitest';

import type {
  Listing,
  RimSpecs,
  TireSpecs,
  WheelSpecs,
} from '@/domain/listing.contract';
import {
  rimSpecsSchema,
  tireSpecsSchema,
  wheelSpecsSchema,
} from '@/domain/listing.validation';
import { getDictionary, type Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import {
  listingCardSummary,
  listingSpecGroups,
  rimSpecRows,
  tireSpecRows,
  wheelSpecGroups,
  type SpecRow,
} from '@/lib/spec-display';

/* -------------------------------------------------------------------------- */
/* Fixtures — every specs object goes through the real strict schema first     */
/* -------------------------------------------------------------------------- */

const LOCALES: readonly Locale[] = ['lt', 'ru', 'en'];

function tire(input: unknown): TireSpecs {
  return tireSpecsSchema.parse(input);
}

function rim(input: unknown): RimSpecs {
  return rimSpecsSchema.parse(input);
}

function wheel(input: unknown): WheelSpecs {
  return wheelSpecsSchema.parse(input);
}

const minimalTireInput = {
  brand: 'Michelin',
  width: 205,
  aspect_ratio: 55,
  diameter: 16,
  season: 'summer',
};

const fullTireInput = {
  ...minimalTireInput,
  model: 'Primacy 4',
  tread_depth: 7.5,
  manufacturing_year: 2021,
  dot: 'dot1234',
  load_index: 91,
  speed_index: 'v',
  xl: true,
  run_flat: false,
  studded: false,
  defects: 'Nedidelis įpjovimas',
  sale_unit: 'set',
};

const minimalRimInput = {
  brand: 'BBS',
  diameter: 18,
  rim_width: 8.5,
  bolt_count: 5,
  pcd: '5x112',
  cb: 66.6,
  et: 35,
  material: 'alloy',
};

const fullRimInput = {
  ...minimalRimInput,
  model: 'CH-R',
  oem_code: '8K0601025',
  origin: 'oem',
  fitment: 'Audi A4 B8',
  color: 'Silver',
  repairs: ['straightened', 'painted'],
};

function listingBase() {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'synthetic-listing',
    title: 'Synthetic listing',
    description: 'Synthetic description for tests.',
    condition: 'used' as const,
    price: 100,
    currency: 'EUR' as const,
    quantity: 4,
    country: 'LT',
    city: 'Vilnius',
    area: null,
    status: 'active' as const,
    moderation_status: 'approved' as const,
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    published_at: '2026-10-01T00:00:00.000Z',
    images: [],
  };
}

function tireListing(specs: TireSpecs): Listing {
  return { ...listingBase(), category: 'padangos', specs };
}

function rimListing(specs: RimSpecs): Listing {
  return { ...listingBase(), category: 'ratlankiai', specs };
}

function wheelListing(specs: WheelSpecs): Listing {
  return { ...listingBase(), category: 'komplektiniai_ratai', specs };
}

function valueOf(rows: readonly SpecRow[], label: string): string | undefined {
  return rows.find((r) => r.label === label)?.value;
}

function labels(rows: readonly SpecRow[]): readonly string[] {
  return rows.map((r) => r.label);
}

/* -------------------------------------------------------------------------- */
/* Tyres                                                                       */
/* -------------------------------------------------------------------------- */

describe('tireSpecRows', () => {
  it.each(LOCALES)('labels and enums come from the %s dictionary', (locale) => {
    const dict = getDictionary(locale);
    const rows = tireSpecRows(tire(fullTireInput), dict, locale);

    expect(valueOf(rows, dict.specs.brand)).toBe('Michelin');
    expect(valueOf(rows, dict.specs.model)).toBe('Primacy 4');
    expect(valueOf(rows, dict.specs.size)).toBe('205/55 R16');
    expect(valueOf(rows, dict.specs.season)).toBe(dict.season.summer);
    expect(valueOf(rows, dict.specs.sale_unit)).toBe(dict.saleUnit.set);
    expect(valueOf(rows, dict.specs.manufacturing_year)).toBe('2021');
    expect(valueOf(rows, dict.specs.dot)).toBe('DOT1234');
    expect(valueOf(rows, dict.specs.load_index)).toBe('91');
    expect(valueOf(rows, dict.specs.speed_index)).toBe('V');
    expect(valueOf(rows, dict.specs.defects)).toBe('Nedidelis įpjovimas');
    // Canonical identifiers never leak into the UI.
    expect(rows.map((r) => r.value)).not.toContain('summer');
    expect(rows.map((r) => r.value)).not.toContain('set');
  });

  it.each(LOCALES)(
    'true -> yes and false -> no are both retained (%s)',
    (locale) => {
      const dict = getDictionary(locale);
      const rows = tireSpecRows(tire(fullTireInput), dict, locale);

      expect(valueOf(rows, dict.specs.xl)).toBe(dict.form.yes);
      expect(valueOf(rows, dict.specs.run_flat)).toBe(dict.form.no);
      expect(valueOf(rows, dict.specs.studded)).toBe(dict.form.no);
    }
  );

  it('tread depth uses locale decimal formatting', () => {
    const specs = tire(fullTireInput);
    expect(
      valueOf(tireSpecRows(specs, getDictionary('en'), 'en'), 'Tread depth')
    ).toBe('7.5 mm');
    const lt = getDictionary('lt');
    expect(valueOf(tireSpecRows(specs, lt, 'lt'), lt.specs.tread_depth)).toBe(
      '7,5 mm'
    );
  });

  it('zero tread depth is shown, not dropped', () => {
    const dict = getDictionary('en');
    const rows = tireSpecRows(tire({ ...minimalTireInput, tread_depth: 0 }), dict, 'en');
    expect(valueOf(rows, dict.specs.tread_depth)).toBe('0 mm');
  });

  it.each(LOCALES)(
    'missing optional fields produce no row and are not fabricated (%s)',
    (locale) => {
      const dict = getDictionary(locale);
      const rows = tireSpecRows(tire(minimalTireInput), dict, locale);

      expect(labels(rows)).toEqual([
        dict.specs.brand,
        dict.specs.size,
        dict.specs.season,
      ]);
      for (const absent of [
        dict.specs.model,
        dict.specs.tread_depth,
        dict.specs.manufacturing_year,
        dict.specs.dot,
        dict.specs.load_index,
        dict.specs.speed_index,
        dict.specs.xl,
        dict.specs.run_flat,
        dict.specs.studded,
        dict.specs.sale_unit,
        dict.specs.defects,
      ]) {
        expect(valueOf(rows, absent)).toBeUndefined();
      }
      expect(rows.map((r) => r.value)).not.toContain(dict.specs.notSpecified);
      expect(rows.map((r) => r.value)).not.toContain(String(new Date().getFullYear()));
    }
  );

  it.each([355, 375, 405])('width %i is not truncated or capped', (width) => {
    const dict = getDictionary('en');
    const rows = tireSpecRows(
      tire({ ...minimalTireInput, width, aspect_ratio: 25, diameter: 20 }),
      dict,
      'en'
    );
    expect(valueOf(rows, dict.specs.size)).toBe(`${width}/25 R20`);
  });
});

/* -------------------------------------------------------------------------- */
/* Rims                                                                        */
/* -------------------------------------------------------------------------- */

describe('rimSpecRows', () => {
  it.each(LOCALES)('labels and enums come from the %s dictionary', (locale) => {
    const dict = getDictionary(locale);
    const rows = rimSpecRows(rim(fullRimInput), dict, locale);

    expect(valueOf(rows, dict.specs.brand)).toBe('BBS');
    expect(valueOf(rows, dict.specs.model)).toBe('CH-R');
    expect(valueOf(rows, dict.specs.diameter)).toBe('R18');
    expect(valueOf(rows, dict.specs.pcd)).toBe('5x112');
    expect(valueOf(rows, dict.specs.bolt_count)).toBe('5');
    expect(valueOf(rows, dict.specs.et)).toBe('ET35');
    expect(valueOf(rows, dict.specs.material)).toBe(dict.material.alloy);
    expect(valueOf(rows, dict.specs.origin)).toBe(dict.origin.oem);
    expect(valueOf(rows, dict.specs.oem_code)).toBe('8K0601025');
    expect(valueOf(rows, dict.specs.color)).toBe('Silver');
    expect(valueOf(rows, dict.specs.repairs)).toBe(
      `${dict.repairs.straightened}, ${dict.repairs.painted}`
    );
  });

  it('CB and rim width are displayed with locale decimals', () => {
    const en = getDictionary('en');
    const enRows = rimSpecRows(rim(minimalRimInput), en, 'en');
    expect(valueOf(enRows, en.specs.cb)).toBe('66.6 mm');
    expect(valueOf(enRows, en.specs.rim_width)).toBe('8.5J');

    const lt = getDictionary('lt');
    const ltRows = rimSpecRows(rim(minimalRimInput), lt, 'lt');
    expect(valueOf(ltRows, lt.specs.cb)).toBe('66,6 mm');
    expect(valueOf(ltRows, lt.specs.rim_width)).toBe('8,5J');
  });

  it.each([
    [-60, 'ET-60'],
    [-15, 'ET-15'],
    [0, 'ET0'],
    [90, 'ET90'],
  ])('ET %i is retained as %s', (et, expected) => {
    const dict = getDictionary('en');
    const specs = rim({ ...minimalRimInput, et });
    const rows = rimSpecRows(specs, dict, 'en');

    expect(valueOf(rows, dict.specs.et)).toBe(expected);
    expect(valueOf(rows, dict.specs.size)).toBe(`8.5Jx18 ${expected}`);
  });

  it.each(LOCALES)(
    'missing optional fields and fitment are not fabricated (%s)',
    (locale) => {
      const dict = getDictionary(locale);
      const rows = rimSpecRows(rim(minimalRimInput), dict, locale);

      for (const absent of [
        dict.specs.model,
        dict.specs.oem_code,
        dict.specs.origin,
        dict.specs.color,
        dict.specs.repairs,
        dict.specs.fitment,
      ]) {
        expect(valueOf(rows, absent)).toBeUndefined();
      }
      expect(rows.map((r) => r.value)).not.toContain(dict.specs.notSpecified);
    }
  );

  it('empty repairs array produces no row', () => {
    const dict = getDictionary('en');
    const rows = rimSpecRows(rim({ ...minimalRimInput, repairs: [] }), dict, 'en');
    expect(valueOf(rows, dict.specs.repairs)).toBeUndefined();
  });

  it('fitment is shown verbatim, never inferred from PCD/CB', () => {
    const dict = getDictionary('en');
    const rows = rimSpecRows(rim(fullRimInput), dict, 'en');
    expect(valueOf(rows, dict.specs.fitment)).toBe('Audi A4 B8');
    expect(rows.filter((r) => r.label === dict.specs.fitment)).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Complete wheels                                                             */
/* -------------------------------------------------------------------------- */

describe('wheelSpecGroups', () => {
  const fullWheel = () =>
    wheel({
      rim: { ...fullRimInput, et: -10, condition: 'used' },
      tire: { ...fullTireInput, diameter: 18, condition: 'new' },
    });

  it.each(LOCALES)(
    'keeps rim and tyre groups in order with their own condition (%s)',
    (locale) => {
      const dict = getDictionary(locale);
      const groups = wheelSpecGroups(fullWheel(), dict, locale);

      expect(groups.map((g) => g.title)).toEqual([
        dict.specs.rimSection,
        dict.specs.tireSection,
      ]);
      const [rimGroup, tireGroup] = groups;
      expect(valueOf(rimGroup?.rows ?? [], dict.specs.condition)).toBe(
        dict.condition.used
      );
      expect(valueOf(tireGroup?.rows ?? [], dict.specs.condition)).toBe(
        dict.condition.new
      );
      expect(valueOf(rimGroup?.rows ?? [], dict.specs.et)).toBe('ET-10');
      expect(valueOf(rimGroup?.rows ?? [], dict.specs.fitment)).toBe('Audi A4 B8');
      expect(valueOf(tireGroup?.rows ?? [], dict.specs.size)).toBe('205/55 R18');
      expect(valueOf(tireGroup?.rows ?? [], dict.specs.run_flat)).toBe(
        dict.form.no
      );
    }
  );

  it('missing halves conditions and optional fields produce no rows', () => {
    const dict = getDictionary('en');
    const groups = wheelSpecGroups(
      wheel({
        rim: minimalRimInput,
        tire: { ...minimalTireInput, diameter: 18 },
      }),
      dict,
      'en'
    );
    const [rimGroup, tireGroup] = groups;

    expect(valueOf(rimGroup?.rows ?? [], dict.specs.condition)).toBeUndefined();
    expect(valueOf(tireGroup?.rows ?? [], dict.specs.condition)).toBeUndefined();
    expect(valueOf(rimGroup?.rows ?? [], dict.specs.fitment)).toBeUndefined();
    expect(labels(tireGroup?.rows ?? [])).toEqual([
      dict.specs.brand,
      dict.specs.size,
      dict.specs.season,
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Category dispatch and card summary                                          */
/* -------------------------------------------------------------------------- */

describe('listingSpecGroups', () => {
  const dict: Dictionary = getDictionary('en');

  it('tyre and rim listings produce one untitled group', () => {
    const tireGroups = listingSpecGroups(tireListing(tire(fullTireInput)), dict, 'en');
    expect(tireGroups).toHaveLength(1);
    expect(tireGroups[0]?.title).toBeNull();
    expect(tireGroups[0]?.rows).toEqual(tireSpecRows(tire(fullTireInput), dict, 'en'));

    const rimGroups = listingSpecGroups(rimListing(rim(fullRimInput)), dict, 'en');
    expect(rimGroups).toHaveLength(1);
    expect(rimGroups[0]?.title).toBeNull();
    expect(rimGroups[0]?.rows).toEqual(rimSpecRows(rim(fullRimInput), dict, 'en'));
  });

  it('complete wheels delegate to the nested groups', () => {
    const specs = wheel({
      rim: { ...minimalRimInput, condition: 'used' },
      tire: { ...minimalTireInput, diameter: 18 },
    });
    expect(listingSpecGroups(wheelListing(specs), dict, 'en')).toEqual(
      wheelSpecGroups(specs, dict, 'en')
    );
  });
});

describe('listingCardSummary', () => {
  it.each(LOCALES)('tyre summary localizes season (%s)', (locale) => {
    const dict = getDictionary(locale);
    expect(
      listingCardSummary(
        tireListing(tire({ ...minimalTireInput, season: 'winter', tread_depth: 6 })),
        dict
      )
    ).toEqual(['205/55 R16', dict.season.winter, '6 mm']);
  });

  it('tyre summary omits missing tread and keeps 375 width', () => {
    const dict = getDictionary('en');
    expect(
      listingCardSummary(
        tireListing(
          tire({ ...minimalTireInput, width: 375, aspect_ratio: 35, diameter: 20 })
        ),
        dict
      )
    ).toEqual(['375/35 R20', dict.season.summer]);
  });

  it('tyre summary keeps zero tread', () => {
    const dict = getDictionary('en');
    expect(
      listingCardSummary(tireListing(tire({ ...minimalTireInput, tread_depth: 0 })), dict)
    ).toEqual(['205/55 R16', dict.season.summer, '0 mm']);
  });

  it.each(LOCALES)('rim summary keeps negative and zero ET (%s)', (locale) => {
    const dict = getDictionary(locale);
    expect(
      listingCardSummary(rimListing(rim({ ...minimalRimInput, et: -20 })), dict)
    ).toEqual(['R18', '5x112', 'ET-20', dict.material.alloy]);
    expect(
      listingCardSummary(rimListing(rim({ ...minimalRimInput, et: 0 })), dict)
    ).toEqual(['R18', '5x112', 'ET0', dict.material.alloy]);
  });

  it('wheel summary uses tyre size, rim PCD and tyre season, no fitment', () => {
    const dict = getDictionary('ru');
    const summary = listingCardSummary(
      wheelListing(
        wheel({
          rim: { ...fullRimInput, condition: 'used' },
          tire: { ...minimalTireInput, diameter: 18, season: 'all_season' },
        })
      ),
      dict
    );
    expect(summary).toEqual(['205/55 R18', '5x112', dict.season.all_season]);
    expect(summary).not.toContain('Audi A4 B8');
  });
});
