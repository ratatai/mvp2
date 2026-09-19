import { describe, it, expect } from 'vitest';

import type { ListingCategory } from '@/domain/canonical';
import { parseListingDraft } from '@/domain/listing.validation';
import {
  buildDraftInput,
  buildSpecs,
  draftToFormValues,
  issuesToFieldErrors,
  specFieldNames,
  type FormValues,
} from '@/components/listing-form/form-model';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const coreValues: FormValues = {
  title: 'Michelin Primacy 4 205/55 R16',
  description: 'Keturios vasarinės padangos, protektorius 7 mm, be defektų.',
  condition: 'used',
  price: '120',
  quantity: '4',
  city: 'Vilnius',
  area: 'Naujamiestis',
};

const tireValues: FormValues = {
  brand: 'Michelin',
  model: 'Primacy 4',
  width: '205',
  aspect_ratio: '55',
  diameter: '16',
  season: 'summer',
  tread_depth: '7.5',
  manufacturing_year: '2021',
  dot: '3021',
  load_index: '91',
  speed_index: 'V',
  xl: 'true',
  run_flat: 'false',
  studded: 'false',
  sale_unit: 'set',
  defects: 'Nedidelis įbrėžimas',
};

const rimValues: FormValues = {
  brand: 'BBS',
  model: 'CH-R',
  diameter: '18',
  rim_width: '8.5',
  bolt_count: '5',
  pcd: '5x112',
  cb: '66.6',
  et: '35',
  material: 'alloy',
  oem_code: '8J0601025',
  origin: 'oem',
  color: 'Juoda',
  repairs: 'straightened,painted',
  fitment: 'Audi A4 B8',
};

function prefixed(values: FormValues, prefix: string): FormValues {
  const out: FormValues = {};
  for (const [key, value] of Object.entries(values)) {
    out[`${prefix}${key}`] = value;
  }
  return out;
}

const wheelValues: FormValues = {
  ...prefixed({ ...rimValues, diameter: '18' }, 'rim.'),
  'rim.condition': 'used',
  ...prefixed({ ...tireValues, diameter: '18' }, 'tire.'),
  'tire.condition': 'new',
};

const tireSpecs = {
  brand: 'Michelin',
  model: 'Primacy 4',
  width: 205,
  aspect_ratio: 55,
  diameter: 16,
  season: 'summer',
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
} as const;

const rimSpecs = {
  brand: 'BBS',
  model: 'CH-R',
  diameter: 18,
  rim_width: 8.5,
  bolt_count: 5,
  pcd: '5x112',
  cb: 66.6,
  et: 35,
  material: 'alloy',
  oem_code: '8J0601025',
  origin: 'oem',
  color: 'Juoda',
  repairs: ['straightened', 'painted'],
  fitment: 'Audi A4 B8',
} as const;

const wheelSpecs = {
  rim: { ...rimSpecs, condition: 'used' },
  tire: { ...tireSpecs, diameter: 18, condition: 'new' },
} as const;

/* -------------------------------------------------------------------------- */
/* buildSpecs                                                                  */
/* -------------------------------------------------------------------------- */

describe('buildSpecs', () => {
  it('omits every empty field instead of defaulting it', () => {
    const specs = buildSpecs('padangos', {
      brand: 'Michelin',
      width: '205',
      aspect_ratio: '55',
      diameter: '16',
      season: 'summer',
      model: '',
      tread_depth: '',
      manufacturing_year: '   ',
      dot: '',
      load_index: '',
      speed_index: '',
      xl: '',
      run_flat: '',
      studded: '',
      sale_unit: '',
      defects: '   ',
    });

    expect(Object.keys(specs).sort()).toEqual([
      'aspect_ratio',
      'brand',
      'diameter',
      'season',
      'width',
    ]);
    expect('model' in specs).toBe(false);
    expect('tread_depth' in specs).toBe(false);
    expect('xl' in specs).toBe(false);
    expect('manufacturing_year' in specs).toBe(false);
  });

  it('ignores a value that is not a valid number or boolean', () => {
    const specs = buildSpecs('padangos', {
      brand: 'Michelin',
      width: 'plati',
      xl: 'maybe',
    });

    expect(Object.keys(specs)).toEqual(['brand']);
  });

  it('converts numbers, booleans and comma separated checkbox lists', () => {
    const specs = buildSpecs('ratlankiai', rimValues);

    expect(specs['diameter']).toBe(18);
    expect(specs['rim_width']).toBe(8.5);
    expect(specs['bolt_count']).toBe(5);
    expect(specs['cb']).toBe(66.6);
    expect(specs['et']).toBe(35);
    expect(specs['pcd']).toBe('5x112');
    expect(specs['repairs']).toEqual(['straightened', 'painted']);
  });

  it('converts the boolean strings, including false', () => {
    const specs = buildSpecs('padangos', tireValues);

    expect(specs['xl']).toBe(true);
    expect(specs['run_flat']).toBe(false);
    expect(specs['studded']).toBe(false);
  });

  it('trims a checkbox list and drops its empty entries', () => {
    const specs = buildSpecs('ratlankiai', {
      ...rimValues,
      repairs: ' straightened , , painted ,',
    });

    expect(specs['repairs']).toEqual(['straightened', 'painted']);
  });

  it('produces the nested rim/tire shape for complete wheels', () => {
    const specs = buildSpecs('komplektiniai_ratai', wheelValues);

    expect(Object.keys(specs).sort()).toEqual(['rim', 'tire']);
    expect(specs['rim']).toEqual({ ...rimSpecs, diameter: 18, condition: 'used' });
    expect(specs['tire']).toEqual({ ...tireSpecs, diameter: 18, condition: 'new' });
  });

  it('only reads the fields its category declares', () => {
    const specs = buildSpecs('padangos', { ...tireValues, ...rimValues });

    expect(Object.keys(specs)).not.toContain('pcd');
    expect(Object.keys(specs)).not.toContain('cb');
    expect(specFieldNames('padangos')).not.toContain('pcd');
  });
});

/* -------------------------------------------------------------------------- */
/* buildDraftInput + parseListingDraft                                         */
/* -------------------------------------------------------------------------- */

describe('buildDraftInput together with parseListingDraft', () => {
  const cases: ReadonlyArray<readonly [ListingCategory, FormValues]> = [
    ['padangos', { ...coreValues, ...tireValues }],
    ['ratlankiai', { ...coreValues, ...rimValues }],
    ['komplektiniai_ratai', { ...coreValues, ...wheelValues }],
  ];

  for (const [category, values] of cases) {
    it(`accepts a complete set of form values for ${category}`, () => {
      const input = buildDraftInput(category, values);
      const result = parseListingDraft(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.draft.category).toBe(category);
        expect(result.draft.price).toBe(120);
        expect(result.draft.quantity).toBe(4);
        expect(result.draft.city).toBe('Vilnius');
        expect(result.draft.area).toBe('Naujamiestis');
      } else {
        expect(result.issues).toEqual([]);
      }
    });
  }

  it('omits an empty area instead of storing an empty string', () => {
    const input = buildDraftInput('padangos', {
      ...coreValues,
      ...tireValues,
      area: '   ',
    });

    expect('area' in input).toBe(false);
  });

  it('produces NaN for a non numeric price so validation can reject it', () => {
    const input = buildDraftInput('padangos', {
      ...coreValues,
      ...tireValues,
      price: 'labai pigiai',
    });

    expect(parseListingDraft(input).ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* draftToFormValues                                                           */
/* -------------------------------------------------------------------------- */

describe('draftToFormValues', () => {
  function toValues(specs: unknown): FormValues {
    return draftToFormValues({
      title: 'Michelin Primacy 4 205/55 R16',
      description: 'Keturios vasarinės padangos, protektorius 7 mm, be defektų.',
      condition: 'used',
      price: 120,
      quantity: 4,
      city: 'Vilnius',
      area: 'Naujamiestis',
      specs,
    });
  }

  it('fills the core values, turning null area into an empty string', () => {
    const values = draftToFormValues({
      title: 'T',
      description: 'D',
      condition: 'new',
      price: 99.5,
      quantity: 2,
      city: 'Kaunas',
      area: null,
      specs: {},
    });

    expect(values['price']).toBe('99.5');
    expect(values['quantity']).toBe('2');
    expect(values['area']).toBe('');
  });

  it('round trips tire specs back to themselves through buildSpecs', () => {
    expect(buildSpecs('padangos', toValues(tireSpecs))).toEqual(tireSpecs);
  });

  it('round trips rim specs back to themselves through buildSpecs', () => {
    expect(buildSpecs('ratlankiai', toValues(rimSpecs))).toEqual(rimSpecs);
  });

  it('round trips complete wheel specs back to themselves through buildSpecs', () => {
    expect(buildSpecs('komplektiniai_ratai', toValues(wheelSpecs))).toEqual(wheelSpecs);
  });

  it('flattens nested specs into dotted field names', () => {
    const values = toValues(wheelSpecs);

    expect(values['rim.brand']).toBe('BBS');
    expect(values['rim.cb']).toBe('66.6');
    expect(values['rim.repairs']).toBe('straightened,painted');
    expect(values['rim.condition']).toBe('used');
    expect(values['tire.xl']).toBe('true');
    expect(values['tire.run_flat']).toBe('false');
  });
});

/* -------------------------------------------------------------------------- */
/* issuesToFieldErrors                                                         */
/* -------------------------------------------------------------------------- */

describe('issuesToFieldErrors', () => {
  it('strips the specs. prefix and maps each issue to its field name', () => {
    const errors = issuesToFieldErrors([
      'specs.width: too_small',
      'specs.rim.cb: invalid_type',
      'title: too_small',
    ]);

    expect(errors).toEqual({
      width: 'too_small',
      'rim.cb': 'invalid_type',
      title: 'too_small',
    });
  });

  it('keeps the first message for a field', () => {
    const errors = issuesToFieldErrors([
      'specs.width: too_small',
      'specs.width: invalid_type',
    ]);

    expect(errors['width']).toBe('too_small');
  });

  it('files a message without a path under _form', () => {
    const errors = issuesToFieldErrors(['something_went_wrong']);

    expect(errors['_form']).toBe('something_went_wrong');
  });

  it('returns an empty map for no issues', () => {
    expect(issuesToFieldErrors([])).toEqual({});
  });
});
