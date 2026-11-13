import { describe, expect, it } from 'vitest';

import { isSyntheticE2eEmail } from '../e2e/synthetic-account';

describe('isSyntheticE2eEmail', () => {
  it.each([
    'seller@example.invalid',
    'e2e-rim-owner@example.test',
    'Seller@Example.Test',
    '  seller@example.invalid  ',
  ])('accepts the synthetic address %s', (value) => {
    expect(isSyntheticE2eEmail(value)).toBe(true);
  });

  it.each([undefined, '', '   '])('rejects a missing value (%j)', (value) => {
    expect(isSyntheticE2eEmail(value)).toBe(false);
  });

  it.each([
    'seller@gmail.com',
    'seller@example.com',
    'seller@example.org',
    'seller@sub.example.test',
    'seller@example.test.evil.com',
    'seller@example.invalid.com',
    'seller@notexample.test',
    'example.test@gmail.com',
    'seller@example.test@gmail.com',
    '@example.test',
    'seller example.test',
    'sel ler@example.test',
  ])('rejects the non-synthetic value %s', (value) => {
    expect(isSyntheticE2eEmail(value)).toBe(false);
  });
});
