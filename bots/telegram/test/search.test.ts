import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Conversation, newSession, type Messenger, type Services } from '../src/conversation';
import { describeFilter, parseQuery } from '../src/search/query';
import type { SpeechToText } from '../src/search/speech';
import { sanitiseFilter, type Understanding } from '../src/search/understand';
import { PositionStore, type NewPosition } from '../src/store';
import type { InlineKeyboard } from '../src/telegram';
import type { TyreDraft } from '../src/draft';

const BRANDS = ['Nokian', 'Michelin', 'BF Goodrich'];

/* -------------------------------------------------------------------------- */
/* Query parsing                                                               */
/* -------------------------------------------------------------------------- */

test('query: size, season and a known brand', () => {
  const { filter, leftover } = parseQuery('205/55 R16 žieminės Nokian', BRANDS);
  assert.deepEqual(filter, { width: 205, aspect_ratio: 55, diameter: 16, season: 'winter', brand: 'Nokian' });
  assert.deepEqual(leftover, []);
});

test('query: Russian phrase with diameter, studs and price limit', () => {
  const { filter } = parseQuery('зимние шипы 16 радиус до 200 евро', BRANDS);
  assert.deepEqual(filter, { diameter: 16, max_price: 200, season: 'winter', studded: true });
});

test('query: R16, used, set, friction', () => {
  assert.deepEqual(parseQuery('R16 б/у комплект липучка', BRANDS).filter, {
    diameter: 16,
    condition: 'used',
    min_quantity: 4,
    studded: false,
  });
  assert.deepEqual(parseQuery('225 45 17', BRANDS).filter, { width: 225, aspect_ratio: 45, diameter: 17 });
  assert.deepEqual(parseQuery('be dyglių r17', BRANDS).filter, { diameter: 17, studded: false });
});

test('query: two-word brand and id lookup', () => {
  assert.equal(parseQuery('bf goodrich 265/70 R16', BRANDS).filter.brand, 'BF Goodrich');
  assert.deepEqual(parseQuery('#12', BRANDS).filter, { id: 12, include_sold: true });
  assert.deepEqual(parseQuery('nr 7', BRANDS).filter, { id: 7, include_sold: true });
});

test('query: unknown words are left over and searched as text', () => {
  const { filter, leftover } = parseQuery('hakkapeliitta 17', BRANDS);
  assert.deepEqual(leftover, ['hakkapeliitta', '17']);
  assert.equal(filter.text, 'hakkapeliitta 17');
});

test('describeFilter shows what was understood', () => {
  assert.equal(
    describeFilter({ width: 205, aspect_ratio: 55, diameter: 16, season: 'winter', brand: 'Nokian' }, 'lt'),
    '205/55 R16 · žieminės · Nokian'
  );
  assert.equal(describeFilter({ diameter: 16, studded: true, max_price: 200 }, 'ru'), 'R16 · шипованные · до 200 €');
});

test('sanitiseFilter drops impossible model output', () => {
  assert.deepEqual(sanitiseFilter({ width: 2055, diameter: 16, season: 'spring', brand: '' }), { diameter: 16 });
  assert.deepEqual(sanitiseFilter({ id: 5, width: 205 }), { id: 5, include_sold: true });
});

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

function position(draft: TyreDraft, photos = ['p1', 'p2']): NewPosition {
  return {
    draft,
    titleLt: `${draft.brand} ${draft.model ?? ''} ${draft.width}/${draft.aspect_ratio} R${draft.diameter}`,
    titleRu: `Шины ${draft.brand}`,
    descriptionLt: 'x',
    descriptionRu: 'x',
    photos,
    createdBy: 1,
  };
}

function seededStore(): PositionStore {
  const store = new PositionStore(':memory:');
  store.add(position({ brand: 'Nokian', model: 'Hakkapeliitta R5', width: 205, aspect_ratio: 55, diameter: 16, season: 'winter', studded: false, quantity: 4, price: 220, condition: 'used' }));
  store.add(position({ brand: 'Michelin', model: 'Primacy 4', width: 205, aspect_ratio: 55, diameter: 16, season: 'summer', quantity: 4, price: 180, condition: 'used' }));
  store.add(position({ brand: 'Nokian', model: 'Hakkapeliitta 10', width: 225, aspect_ratio: 45, diameter: 17, season: 'winter', studded: true, quantity: 2, price: 150, condition: 'used' }));
  return store;
}

test('store: filters, text match, sold positions hidden', () => {
  const store = seededStore();
  assert.equal(store.search({ width: 205, aspect_ratio: 55, diameter: 16 }).total, 2);
  assert.equal(store.search({ season: 'winter' }).total, 2);
  assert.equal(store.search({ brand: 'nokian', studded: true }).total, 1);
  assert.equal(store.search({ text: 'hakkapeliitta' }).total, 2);
  assert.equal(store.search({ max_price: 200 }).total, 2);
  assert.equal(store.search({ min_quantity: 4 }).total, 2);

  assert.ok(store.setStatus(2, 'sold'));
  assert.equal(store.search({ width: 205 }).total, 1);
  assert.equal(store.search({ id: 2, include_sold: true }).total, 1);
  assert.deepEqual(store.knownBrands().sort(), ['Michelin', 'Nokian']);
  assert.ok(store.delete(3));
  assert.equal(store.get(3), null);
});

test('store: wildcard characters in a query never act as wildcards', () => {
  const store = seededStore();
  // Punctuation is folded away, so "%%" is an empty text filter (everything active).
  assert.equal(store.search({ text: '%%' }).total, 3);
});

/* -------------------------------------------------------------------------- */
/* Conversation: search, voice, stock actions                                  */
/* -------------------------------------------------------------------------- */

class FakeChat implements Messenger {
  readonly log: { text: string; keyboard?: InlineKeyboard }[] = [];
  readonly albums: (readonly string[])[] = [];
  async send(text: string, keyboard?: InlineKeyboard) {
    this.log.push(keyboard === undefined ? { text } : { text, keyboard });
    return this.log.length;
  }
  async edit() {}
  async clearButtons() {}
  async sendPhoto(_fileId: string, caption: string, keyboard?: InlineKeyboard) {
    return this.send(`[photo] ${caption}`, keyboard);
  }
  async sendAlbum(fileIds: readonly string[]) {
    this.albums.push(fileIds);
  }
  texts() {
    return this.log.map((m) => m.text);
  }
}

function make(overrides: Partial<Services>, lang: 'lt' | 'ru' = 'lt') {
  const chat = new FakeChat();
  const store = overrides.store ?? seededStore();
  const services: Services = {
    vision: null,
    loadPhoto: async () => ({ mediaType: 'image/jpeg', base64: '' }),
    store,
    speech: null,
    understanding: null,
    userId: 1,
    ...overrides,
  };
  return { chat, store, conv: new Conversation(newSession(lang), chat, services, 2026) };
}

test('typed search shows what was understood and cards with photos', async () => {
  const { chat, conv } = make({});
  await conv.onText('205/55 R16 žieminės');
  const texts = chat.texts();
  assert.equal(texts[0], '🔎 205/55 R16 · žieminės — rasta: 1');
  assert.match(texts[1] ?? '', /^\[photo\] #1 · Nokian Hakkapeliitta R5/);
});

test('words that match nothing are dropped instead of hiding real matches', async () => {
  const { chat, conv } = make({});
  await conv.onText('R17 dygliuotos raudonos');
  assert.ok(chat.texts().some((t) => t.includes('Su „raudonos“ nieko nėra')));
  assert.ok(chat.texts().some((t) => t.includes('#3')));
});

test('voice search: transcript → model filter → results', async () => {
  const speech: SpeechToText = { transcribe: async () => 'двести пять пятьдесят пять шестнадцать летние' };
  const understanding: Understanding = {
    toFilter: async () => ({ width: 205, aspect_ratio: 55, diameter: 16, season: 'summer' }),
    normaliseAnswer: async () => '',
  };
  const { chat, conv } = make({ speech, understanding }, 'ru');
  await conv.onVoice(new Uint8Array([1]));
  const texts = chat.texts();
  assert.equal(texts[0], '🎤 «двести пять пятьдесят пять шестнадцать летние»');
  assert.equal(texts[1], '🔎 205/55 R16 · летние — найдено: 1');
  assert.match(texts[2] ?? '', /#2 · Шины Michelin/);
});

test('voice search falls back to the plain parser when the model fails', async () => {
  const speech: SpeechToText = { transcribe: async () => '205/55 R16 зимние' };
  const understanding: Understanding = {
    toFilter: async () => {
      throw new Error('down');
    },
    normaliseAnswer: async () => '',
  };
  const { chat, conv } = make({ speech, understanding }, 'ru');
  const original = console.error;
  console.error = () => {};
  try {
    await conv.onVoice(new Uint8Array([1]));
  } finally {
    console.error = original;
  }
  assert.equal(chat.texts()[1], '🔎 205/55 R16 · зимние — найдено: 1');
});

test('voice answer to a question: spoken size is normalised and accepted', async () => {
  const speech: SpeechToText = { transcribe: async () => 'двести пять пятьдесят пять эр шестнадцать' };
  const understanding: Understanding = {
    toFilter: async () => ({}),
    normaliseAnswer: async () => '205/55 R16',
  };
  const { chat, conv } = make({ speech, understanding }, 'ru');
  conv.session.phase = 'asking';
  conv.session.photos = ['f'];
  await conv.onButton('restart'); // fresh state
  conv.session.phase = 'asking';
  // Ask the first question (size) the way the flow does after analysis.
  await (conv as unknown as { askNext(): Promise<void> }).askNext();
  assert.match(chat.texts().at(-1) ?? '', /Какой размер/);
  await conv.onVoice(new Uint8Array([1]));
  assert.deepEqual(
    [conv.session.draft.width, conv.session.draft.aspect_ratio, conv.session.draft.diameter],
    [205, 55, 16]
  );
  assert.match(chat.texts().at(-1) ?? '', /производитель/);
});

test('voice answer: a spoken choice picks the button', async () => {
  const speech: SpeechToText = { transcribe: async () => 'Зимние.' };
  const { conv } = make({ speech }, 'ru');
  conv.session.phase = 'asking';
  conv.session.draft = { width: 205, aspect_ratio: 55, diameter: 16, brand: 'Nokian' };
  await (conv as unknown as { askNext(): Promise<void> }).askNext();
  await conv.onVoice(new Uint8Array([1]));
  assert.equal(conv.session.draft.season, 'winter');
});

test('stock actions: all photos, sold, back to sale, delete with confirmation', async () => {
  const { chat, store, conv } = make({});
  await conv.onButton('ph:1');
  assert.deepEqual(chat.albums[0], ['p1', 'p2']);

  await conv.onButton('sold:1');
  assert.equal(store.get(1)?.status, 'sold');
  await conv.onButton('act:1');
  assert.equal(store.get(1)?.status, 'active');

  await conv.onButton('del:1');
  assert.ok(store.get(1));
  await conv.onButton('delok:1');
  assert.equal(store.get(1), null);
  await conv.onButton('ph:1');
  assert.equal(chat.texts().at(-1), 'Tokios pozicijos nėra.');
});

test('paging: "more" shows the next page', async () => {
  const store = new PositionStore(':memory:');
  for (let i = 0; i < 7; i += 1) {
    store.add(position({ brand: 'Nokian', width: 205, aspect_ratio: 55, diameter: 16, season: 'winter' }));
  }
  const { chat, conv } = make({ store });
  await conv.onText('R16');
  assert.equal(chat.log.filter((m) => m.text.startsWith('[photo]')).length, 5);
  assert.equal(chat.texts().at(-1), '5 / 7');
  await conv.onButton('more');
  assert.equal(chat.log.filter((m) => m.text.startsWith('[photo]')).length, 7);
});
