import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDescription, buildTitle, toListingDraft } from '../src/compose';
import { Conversation, newSession, type Messenger } from '../src/conversation';
import { coerceReadings } from '../src/extraction/coerce';
import { normalizeReadings } from '../src/extraction/normalize';
import type { PhotoReadings, VisionProvider } from '../src/extraction/types';
import type { InlineKeyboard } from '../src/telegram';

const YEAR = 2026;
const none = { value: null, confidence: 'low' as const };

function readings(overrides: Partial<PhotoReadings>): PhotoReadings {
  return {
    is_tyre_photo: true,
    tyres_visible: null,
    brand: none,
    model: none,
    size: none,
    service_description: none,
    season: none,
    dot: none,
    xl: none,
    run_flat: none,
    studded: none,
    tread_depth: none,
    condition: none,
    defects: none,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */

test('coerce: wrong shapes become "not read" instead of failing', () => {
  const r = coerceReadings({
    is_tyre_photo: true,
    brand: { value: 'Michelin', confidence: 'high' },
    size: { value: 205, confidence: 'high' },
    season: { value: 'spring', confidence: 'high' },
  });
  assert.ok(r);
  assert.equal(r.brand.value, 'Michelin');
  assert.equal(r.size.value, null);
  assert.equal(r.season.value, null);
  assert.equal(coerceReadings('nope'), null);
});

test('normalize: only confident and valid readings are accepted; DOT year is computed', () => {
  const result = normalizeReadings(
    readings({
      brand: { value: 'Michelin', confidence: 'high' },
      model: { value: 'Primacy 4', confidence: 'low' },
      size: { value: '205/55 R16', confidence: 'high' },
      service_description: { value: '91V', confidence: 'high' },
      dot: { value: 'DOT EX2B 4521', confidence: 'high' },
      season: { value: 'summer', confidence: 'high' },
      tread_depth: { value: 9.9, confidence: 'high' },
      condition: { value: 'used', confidence: 'high' },
      defects: { value: 'Nedidelis įpjovimas šone', confidence: 'high' },
      tyres_visible: 4,
    }),
    YEAR
  );
  assert.deepEqual(result.accepted, {
    brand: 'Michelin',
    width: 205,
    aspect_ratio: 55,
    diameter: 16,
    load_index: 91,
    speed_index: 'V',
    season: 'summer',
    dot: 'EX2B4521',
    manufacturing_year: 2021,
    tread_depth: 10,
  });
  // Doubtful model, and condition/defects/quantity are always confirmed.
  assert.deepEqual(result.suggestions, {
    model: 'Primacy 4',
    condition: 'used',
    defects: 'Nedidelis įpjovimas šone',
    quantity: 4,
  });
});

test('normalize: an unreadable size is not accepted even if the model is "sure"', () => {
  const result = normalizeReadings(readings({ size: { value: '2O5/55 R16', confidence: 'high' } }), YEAR);
  assert.equal(result.accepted.width, undefined);
});

/* -------------------------------------------------------------------------- */

test('compose: texts and a payload the site schema accepts', () => {
  const draft = {
    brand: 'Nokian',
    model: 'Hakkapeliitta R5',
    width: 225,
    aspect_ratio: 45,
    diameter: 17,
    season: 'winter' as const,
    studded: false,
    tread_depth: 6.5,
    dot: '4521',
    manufacturing_year: 2021,
    condition: 'used' as const,
    quantity: 4,
    sale_unit: 'set' as const,
    price: 240,
    city: 'Vilnius',
  };
  assert.equal(buildTitle(draft, 'lt'), 'Nokian Hakkapeliitta R5 225/45 R17 žieminės padangos, 4 vnt.');
  assert.equal(buildTitle(draft, 'ru'), 'Шины Nokian Hakkapeliitta R5 225/45 R17 зимние, 4 шт.');
  const lt = buildDescription(draft, 'lt');
  assert.match(lt, /Protektoriaus gylis: 6,5 mm/);
  assert.match(lt, /Kaina: 240 € už visas 4 vnt\./);
  assert.doesNotMatch(lt, /dygliuotos/);
  assert.match(buildDescription(draft, 'ru'), /Глубина протектора: 6,5 мм/);

  const parsed = toListingDraft(draft);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.issues.join(', '));
});

test('compose: a draft missing required fields is rejected by the site schema', () => {
  const parsed = toListingDraft({ brand: 'Nokian', width: 225, aspect_ratio: 45, diameter: 17 });
  assert.equal(parsed.ok, false);
});

/* -------------------------------------------------------------------------- */

class FakeChat implements Messenger {
  readonly log: { text: string; keyboard?: InlineKeyboard }[] = [];
  async send(text: string, keyboard?: InlineKeyboard) {
    this.log.push(keyboard === undefined ? { text } : { text, keyboard });
    return this.log.length;
  }
  async edit() {}
  async clearButtons() {}
  last() {
    const item = this.log[this.log.length - 1];
    assert.ok(item);
    return item;
  }
  button(label: RegExp): string {
    const found = this.last().keyboard?.flat().find((b) => label.test(b.text));
    assert.ok(found, `no button ${label} in "${this.last().text}"`);
    return found.callback_data;
  }
}

function vision(r: PhotoReadings): VisionProvider {
  return { name: 'fake', readPhotos: async () => r };
}

test('flow: photos → read → confirm doubts → ask gaps → LT and RU texts', async () => {
  const chat = new FakeChat();
  const conv = new Conversation(
    newSession('lt'),
    chat,
    vision(
      readings({
        brand: { value: 'Michelin', confidence: 'high' },
        size: { value: '205/55 R16', confidence: 'high' },
        season: { value: 'summer', confidence: 'low' },
        service_description: { value: '91V', confidence: 'high' },
        dot: { value: 'DOT 3021', confidence: 'high' },
        xl: { value: false, confidence: 'high' },
        run_flat: { value: false, confidence: 'high' },
        tyres_visible: 4,
      })
    ),
    async () => ({ mediaType: 'image/jpeg', base64: '' }),
    YEAR
  );

  await conv.onPhoto('f1');
  await conv.onPhoto('f2');
  await conv.onButton(chat.button(/Analizuoti/));
  assert.ok(chat.log.some((m) => m.text.includes('205/55 R16')));

  // Season was doubtful → confirmation.
  assert.match(chat.last().text, /Sezonas: Vasarinės\?/);
  await conv.onButton('y');

  assert.match(chat.last().text, /būklė/i);
  await conv.onButton(chat.button(/Naudotos/));

  // Quantity is suggested from the photos → confirmation.
  assert.match(chat.last().text, /Kiekis: 4 vnt\./);
  await conv.onButton('y');

  assert.match(chat.last().text, /kaina/i);
  await conv.onText('abc');
  assert.match(chat.last().text, /Nesupratau/);
  await conv.onText('160 €');

  await conv.onText('Vilnius');
  await conv.onText('7,5'); // tread depth
  await conv.onButton(chat.button(/Komplektas/)); // sale unit
  await conv.onButton('skip'); // model
  // load/speed, DOT, XL, run flat came from the photos; defects is next.
  assert.match(chat.last().text, /defekt/i);
  await conv.onButton(chat.button(/^Nėra$/));

  assert.match(chat.last().text, /Skelbimas paruoštas/);
  assert.match(chat.last().text, /Michelin 205\/55 R16 vasarinės padangos, 4 vnt\./);

  await conv.onButton('done');
  const ru = chat.last().text;
  assert.match(ru, /Летние шины|Б\/у летние шины/);
  assert.match(ru, /Год выпуска: 2021 \(DOT 3021\)/);
  assert.match(ru, /Цена: 160 € за все 4 шт\./);
});

test('flow: vision failure falls back to asking everything', async () => {
  const chat = new FakeChat();
  const failing: VisionProvider = {
    name: 'broken',
    readPhotos: async () => {
      throw new Error('boom');
    },
  };
  const conv = new Conversation(newSession('ru'), chat, failing, async () => ({ mediaType: 'image/jpeg', base64: '' }), YEAR);
  const original = console.error;
  console.error = () => {};
  try {
    await conv.onPhoto('f1');
    await conv.onButton('analyse');
  } finally {
    console.error = original;
  }
  assert.ok(chat.log.some((m) => m.text.includes('Не удалось прочитать фото')));
  assert.match(chat.last().text, /Какой размер шин/);
  await conv.onText('195/65 R15');
  assert.match(chat.last().text, /производитель/);
});

test('flow: editing quantity re-asks the sale unit', async () => {
  const chat = new FakeChat();
  const session = newSession('lt');
  const conv = new Conversation(session, chat, null, async () => ({ mediaType: 'image/jpeg', base64: '' }), YEAR);
  session.phase = 'summary';
  session.draft = {
    brand: 'Nokian', width: 205, aspect_ratio: 55, diameter: 16, season: 'summer',
    condition: 'new', quantity: 4, sale_unit: 'set', price: 300, city: 'Kaunas',
  };
  for (const id of ['model', 'load_speed', 'dot', 'xl', 'run_flat', 'defects'] as const) session.settled.add(id);

  await conv.onButton('e:quantity');
  assert.match(chat.last().text, /Kiek padangų/);
  await conv.onButton(chat.button(/^2$/));
  assert.match(chat.last().text, /Kaip parduodi/);
});
