import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normaliseDot,
  parseDecimal,
  parsePrice,
  parseServiceDescription,
  parseTyreSize,
  yearFromDotDate,
} from '../src/parse';

test('tyre size: common printed forms', () => {
  const expected = { width: 205, aspect_ratio: 55, diameter: 16 };
  for (const raw of ['205/55 R16', '205/55R16', '205/55 r16', ' 205 / 55 R 16 ', '205 55 16', '205/55 ZR16', '205/55 RF16']) {
    assert.deepEqual(parseTyreSize(raw), expected, raw);
  }
  assert.deepEqual(parseTyreSize('215/65 R16C'), { width: 215, aspect_ratio: 65, diameter: 16 });
});

test('tyre size: width is not capped at 305, nonsense is rejected', () => {
  assert.deepEqual(parseTyreSize('355/25 R21'), { width: 355, aspect_ratio: 25, diameter: 21 });
  assert.equal(parseTyreSize('99/55 R16'), null);
  assert.equal(parseTyreSize('205/55'), null);
  assert.equal(parseTyreSize('205/55 R30'), null);
  assert.equal(parseTyreSize('Michelin'), null);
});

test('service description', () => {
  assert.deepEqual(parseServiceDescription('91V'), { load_index: 91, speed_index: 'V' });
  assert.deepEqual(parseServiceDescription('91 v'), { load_index: 91, speed_index: 'V' });
  assert.deepEqual(parseServiceDescription('102/100T'), { load_index: 102, speed_index: 'T' });
  assert.equal(parseServiceDescription('91'), null);
  assert.equal(parseServiceDescription('91I'), null);
  assert.equal(parseServiceDescription('500V'), null);
});

test('DOT date → year, never in the future, impossible weeks rejected', () => {
  assert.equal(yearFromDotDate('4521', 2026), 2021);
  assert.equal(yearFromDotDate('0124', 2026), 2024);
  assert.equal(yearFromDotDate('5421', 2026), null);
  assert.equal(yearFromDotDate('0029', 2026), null);
  assert.equal(yearFromDotDate('1230', 2026), null);
  assert.equal(yearFromDotDate('451', 2026), null);
});

test('DOT normalisation matches the site format', () => {
  assert.equal(normaliseDot('DOT EX 2B 4521'), 'EX2B4521');
  assert.equal(normaliseDot('4521'), '4521');
  assert.equal(normaliseDot('dot'), null);
  assert.equal(normaliseDot('AB'), null);
});

test('numbers and prices', () => {
  assert.equal(parseDecimal('6,5'), 6.5);
  assert.equal(parseDecimal('7 mm'), 7);
  assert.equal(parseDecimal('abc'), null);
  assert.equal(parsePrice('120'), 120);
  assert.equal(parsePrice('120,50 €'), 120.5);
  assert.equal(parsePrice('120.555'), null);
  assert.equal(parsePrice('-5'), null);
});
