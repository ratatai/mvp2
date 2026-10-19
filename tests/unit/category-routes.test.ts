import { describe, expect, it } from 'vitest';

import { categoryFromSlug } from '@/lib/routes';

describe('categoryFromSlug', () => {
  it.each([
    ['padangos', 'padangos'],
    ['ratlankiai', 'ratlankiai'],
    ['komplektiniai-ratai', 'komplektiniai_ratai'],
  ])('maps the supported slug %s', (slug, category) => {
    expect(categoryFromSlug(slug)).toBe(category);
  });

  it.each([
    '__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty',
    '', 'unknown', 'komplektiniai_ratai', 'Padangos',
  ])('rejects unsupported or inherited key %s', (slug) => {
    expect(categoryFromSlug(slug)).toBeNull();
  });
});
