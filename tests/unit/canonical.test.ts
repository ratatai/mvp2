import { describe, it, expect } from 'vitest';

import {
  isListingCategory,
  isListingCondition,
  isListingSort,
  isListingStatus,
  isModerationStatus,
  isRimMaterial,
  isTireSeason,
  mapLegacyCategory,
  mapLegacyCondition,
  mapLegacySeason,
  mapLegacySpecKey,
  mapLegacySpecKeys,
} from '@/domain/canonical';

describe('mapLegacySeason', () => {
  it('maps the Lithuanian UI strings to canonical seasons', () => {
    expect(mapLegacySeason('vasara')).toBe('summer');
    expect(mapLegacySeason('žiema')).toBe('winter');
    expect(mapLegacySeason('visasezonis')).toBe('all_season');
  });

  it('passes already canonical values through unchanged', () => {
    expect(mapLegacySeason('summer')).toBe('summer');
    expect(mapLegacySeason('winter')).toBe('winter');
    expect(mapLegacySeason('all_season')).toBe('all_season');
  });

  it('returns null for an unknown string', () => {
    expect(mapLegacySeason('ruduo')).toBeNull();
    expect(mapLegacySeason('')).toBeNull();
    expect(mapLegacySeason('   ')).toBeNull();
  });

  it('returns null for a non-string input', () => {
    expect(mapLegacySeason(undefined)).toBeNull();
    expect(mapLegacySeason(null)).toBeNull();
    expect(mapLegacySeason(4)).toBeNull();
    expect(mapLegacySeason({ season: 'vasara' })).toBeNull();
    expect(mapLegacySeason(['vasara'])).toBeNull();
  });
});

describe('mapLegacyCondition', () => {
  it('maps the Lithuanian UI strings to canonical conditions', () => {
    expect(mapLegacyCondition('naujas')).toBe('new');
    expect(mapLegacyCondition('naudotas')).toBe('used');
  });

  it('passes already canonical values through unchanged', () => {
    expect(mapLegacyCondition('new')).toBe('new');
    expect(mapLegacyCondition('used')).toBe('used');
  });

  it('returns null for anything unrecognised', () => {
    expect(mapLegacyCondition('refurbished')).toBeNull();
    expect(mapLegacyCondition(1)).toBeNull();
    expect(mapLegacyCondition(null)).toBeNull();
  });
});

describe('mapLegacyCategory', () => {
  it('maps every legacy category name', () => {
    expect(mapLegacyCategory('ratai')).toBe('komplektiniai_ratai');
    expect(mapLegacyCategory('tires')).toBe('padangos');
    expect(mapLegacyCategory('wheels')).toBe('ratlankiai');
    expect(mapLegacyCategory('sets')).toBe('komplektiniai_ratai');
  });

  it('passes already canonical values through unchanged', () => {
    expect(mapLegacyCategory('padangos')).toBe('padangos');
    expect(mapLegacyCategory('ratlankiai')).toBe('ratlankiai');
    expect(mapLegacyCategory('komplektiniai_ratai')).toBe('komplektiniai_ratai');
  });

  it('returns null for anything unrecognised', () => {
    expect(mapLegacyCategory('akumuliatoriai')).toBeNull();
    expect(mapLegacyCategory(42)).toBeNull();
    expect(mapLegacyCategory(undefined)).toBeNull();
  });
});

describe('mapLegacySpecKey', () => {
  it('maps the camelCase legacy keys onto canonical ones', () => {
    expect(mapLegacySpecKey('centerBore')).toBe('cb');
    expect(mapLegacySpecKey('offset')).toBe('et');
  });

  it('leaves an unknown key unchanged', () => {
    expect(mapLegacySpecKey('brand')).toBe('brand');
    expect(mapLegacySpecKey('totally_made_up')).toBe('totally_made_up');
  });
});

describe('mapLegacySpecKeys', () => {
  it('never produces both cb and centerBore', () => {
    const fromLegacyFirst = mapLegacySpecKeys({ centerBore: 66.6, cb: 57.1 });
    expect(Object.keys(fromLegacyFirst)).toEqual(['cb']);
    expect(fromLegacyFirst['cb']).toBe(66.6);

    const fromCanonicalFirst = mapLegacySpecKeys({ cb: 57.1, centerBore: 66.6 });
    expect(Object.keys(fromCanonicalFirst)).toEqual(['cb']);
    expect(fromCanonicalFirst['cb']).toBe(57.1);
  });

  it('never produces both et and offset', () => {
    const mapped = mapLegacySpecKeys({ offset: 35, et: 45 });
    expect(Object.keys(mapped)).toEqual(['et']);
    expect('offset' in mapped).toBe(false);
  });

  it('passes values through untouched, inventing and converting nothing', () => {
    const input = {
      brand: 'BBS',
      centerBore: '66.6',
      offset: null,
      rimWidth: 8.5,
      repairs: ['painted'],
      nested: { keep: true },
    } as const;

    const mapped = mapLegacySpecKeys(input);

    expect(mapped['brand']).toBe('BBS');
    // The string stays a string: the mapper must not parse or round it.
    expect(mapped['cb']).toBe('66.6');
    expect(mapped['et']).toBeNull();
    expect(mapped['rim_width']).toBe(8.5);
    expect(mapped['repairs']).toBe(input.repairs);
    expect(mapped['nested']).toBe(input.nested);
  });

  it('leaves canonical keys and unknown keys alone', () => {
    const mapped = mapLegacySpecKeys({ cb: 66.6, et: 35, whatever: 'x' });
    expect(mapped).toEqual({ cb: 66.6, et: 35, whatever: 'x' });
  });
});

describe('type guards', () => {
  it('rejects wrong values for categories, conditions and statuses', () => {
    expect(isListingCategory('padangos')).toBe(true);
    expect(isListingCategory('ratai')).toBe(false);
    expect(isListingCategory(null)).toBe(false);

    expect(isListingCondition('used')).toBe(true);
    expect(isListingCondition('naudotas')).toBe(false);
    expect(isListingCondition(0)).toBe(false);

    expect(isListingStatus('active')).toBe(true);
    expect(isListingStatus('published')).toBe(false);

    expect(isModerationStatus('approved')).toBe(true);
    expect(isModerationStatus('ok')).toBe(false);
  });

  it('rejects wrong values for seasons, materials and sorts', () => {
    expect(isTireSeason('all_season')).toBe(true);
    expect(isTireSeason('all-season')).toBe(false);

    expect(isRimMaterial('alloy')).toBe(true);
    expect(isRimMaterial('wood')).toBe(false);

    expect(isListingSort('price_desc')).toBe(true);
    expect(isListingSort('cheapest')).toBe(false);
    expect(isListingSort(undefined)).toBe(false);
  });
});
