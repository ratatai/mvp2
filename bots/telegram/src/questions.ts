/**
 * The questions the bot asks for anything the photos did not settle.
 *
 * Required questions (what the site's schema needs) come first and cannot be
 * skipped; optional ones offer a "don't know" button. A question is settled
 * when all its fields have a value or the seller skipped it.
 */

import type { DraftKey, TyreDraft } from './draft';
import { t, type Lang } from './i18n';
import { SITE_DICT } from './i18n';
import {
  normaliseDot,
  dotDateGroup,
  parseDecimal,
  parseIntIn,
  parsePrice,
  parseServiceDescription,
  parseText,
  parseTyreSize,
  yearFromDotDate,
} from './parse';

export type QuestionId =
  | 'size'
  | 'brand'
  | 'season'
  | 'condition'
  | 'quantity'
  | 'price'
  | 'city'
  | 'tread_depth'
  | 'sale_unit'
  | 'model'
  | 'load_speed'
  | 'dot'
  | 'xl'
  | 'run_flat'
  | 'studded'
  | 'defects';

export interface Choice {
  readonly label: string;
  /** null = "nothing to record" (e.g. "no defects"), the question is settled. */
  readonly patch: Partial<TyreDraft> | null;
}

export interface Question {
  readonly id: QuestionId;
  /** Fields this question fills; the first one labels confirmations. */
  readonly keys: readonly DraftKey[];
  readonly required: boolean;
  relevant(d: TyreDraft): boolean;
  prompt(lang: Lang): string;
  choices?(lang: Lang, d: TyreDraft): readonly Choice[];
  /** Free-text answer → patch, or null if not understood. */
  parse?(text: string, d: TyreDraft): Partial<TyreDraft> | null;
}

const always = () => true;

const bool = (key: 'xl' | 'run_flat' | 'studded') => (lang: Lang): readonly Choice[] => [
  { label: t(lang).yesBool, patch: { [key]: true } },
  { label: t(lang).noBool, patch: { [key]: false } },
];

export function dotPatch(text: string, currentYear: number): Partial<TyreDraft> | null {
  const dot = normaliseDot(text);
  if (dot === null) return null;
  const group = dotDateGroup(dot);
  const year = group === null ? null : yearFromDotDate(group, currentYear);
  // A bare 4-digit answer must be a valid week/year, otherwise it is a typo.
  if (/^\d{4}$/.test(dot) && year === null) return null;
  return year === null ? { dot } : { dot, manufacturing_year: year };
}

export function buildQuestions(currentYear: number): readonly Question[] {
  return [
    {
      id: 'size',
      keys: ['width', 'aspect_ratio', 'diameter'],
      required: true,
      relevant: always,
      prompt: (lang) => t(lang).q.size,
      parse: (text) => parseTyreSize(text),
    },
    {
      id: 'brand',
      keys: ['brand'],
      required: true,
      relevant: always,
      prompt: (lang) => t(lang).q.brand,
      parse: (text) => {
        const brand = parseText(text, 60);
        return brand === null ? null : { brand };
      },
    },
    {
      id: 'season',
      keys: ['season'],
      required: true,
      relevant: always,
      prompt: (lang) => t(lang).q.season,
      choices: (lang) =>
        (['summer', 'winter', 'all_season'] as const).map((season) => ({
          label: SITE_DICT[lang].season[season],
          patch: { season },
        })),
    },
    {
      id: 'condition',
      keys: ['condition'],
      required: true,
      relevant: always,
      prompt: (lang) => t(lang).q.condition,
      choices: (lang) =>
        (['new', 'used'] as const).map((condition) => ({
          label: SITE_DICT[lang].condition[condition],
          patch: { condition },
        })),
    },
    {
      id: 'quantity',
      keys: ['quantity'],
      required: true,
      relevant: always,
      prompt: (lang) => t(lang).q.quantity,
      // One tyre can only be sold as a single; that is not a guess.
      choices: () => [
        { label: '1', patch: { quantity: 1, sale_unit: 'single' } },
        { label: '2', patch: { quantity: 2 } },
        { label: '4', patch: { quantity: 4 } },
      ],
      parse: (text) => {
        const quantity = parseIntIn(text, 1, 100);
        if (quantity === null) return null;
        return quantity === 1 ? { quantity, sale_unit: 'single' } : { quantity };
      },
    },
    {
      id: 'price',
      keys: ['price'],
      required: true,
      relevant: always,
      prompt: (lang) => t(lang).q.price,
      parse: (text) => {
        const price = parsePrice(text);
        return price === null ? null : { price };
      },
    },
    {
      id: 'city',
      keys: ['city'],
      required: true,
      relevant: always,
      prompt: (lang) => t(lang).q.city,
      parse: (text) => {
        const city = parseText(text, 80);
        return city === null ? null : { city };
      },
    },
    {
      id: 'tread_depth',
      keys: ['tread_depth'],
      required: false,
      relevant: (d) => d.condition !== 'new',
      prompt: (lang) => t(lang).q.tread_depth,
      parse: (text) => {
        const value = parseDecimal(text);
        return value === null || value < 0 || value > 20 ? null : { tread_depth: value };
      },
    },
    {
      id: 'sale_unit',
      keys: ['sale_unit'],
      required: false,
      relevant: (d) => d.quantity !== undefined && d.quantity > 1,
      prompt: (lang) => t(lang).q.sale_unit,
      choices: (lang) =>
        (['set', 'pair', 'single'] as const).map((sale_unit) => ({
          label: SITE_DICT[lang].saleUnit[sale_unit],
          patch: { sale_unit },
        })),
    },
    {
      id: 'model',
      keys: ['model'],
      required: false,
      relevant: always,
      prompt: (lang) => t(lang).q.model,
      parse: (text) => {
        const model = parseText(text, 80);
        return model === null ? null : { model };
      },
    },
    {
      id: 'load_speed',
      keys: ['load_index', 'speed_index'],
      required: false,
      relevant: always,
      prompt: (lang) => t(lang).q.load_speed,
      parse: (text) => parseServiceDescription(text),
    },
    {
      id: 'dot',
      keys: ['dot'],
      required: false,
      relevant: always,
      prompt: (lang) => t(lang).q.dot,
      parse: (text) => dotPatch(text, currentYear),
    },
    {
      id: 'xl',
      keys: ['xl'],
      required: false,
      relevant: always,
      prompt: (lang) => t(lang).q.xl,
      choices: bool('xl'),
    },
    {
      id: 'run_flat',
      keys: ['run_flat'],
      required: false,
      relevant: always,
      prompt: (lang) => t(lang).q.run_flat,
      choices: bool('run_flat'),
    },
    {
      id: 'studded',
      keys: ['studded'],
      required: false,
      relevant: (d) => d.season === 'winter',
      prompt: (lang) => t(lang).q.studded,
      choices: bool('studded'),
    },
    {
      id: 'defects',
      keys: ['defects'],
      required: false,
      relevant: always,
      prompt: (lang) => t(lang).q.defects,
      choices: (lang) => [{ label: t(lang).none, patch: null }],
      parse: (text) => {
        const defects = parseText(text, 500, 3);
        return defects === null ? null : { defects };
      },
    },
  ];
}

export function isSettled(q: Question, d: TyreDraft, settled: ReadonlySet<QuestionId>): boolean {
  if (settled.has(q.id)) return true;
  return q.keys.every((key) => d[key] !== undefined);
}

/** The next question to ask, or null when the draft is complete. */
export function nextQuestion(
  questions: readonly Question[],
  d: TyreDraft,
  settled: ReadonlySet<QuestionId>
): Question | null {
  return questions.find((q) => q.relevant(d) && !isSettled(q, d, settled)) ?? null;
}

/** The part of the suggestions that answers this question, if complete. */
export function suggestionFor(q: Question, suggestions: Partial<TyreDraft>): Partial<TyreDraft> | null {
  if (!q.keys.every((key) => suggestions[key] !== undefined)) return null;
  const patch: Record<string, unknown> = {};
  for (const key of q.keys) patch[key] = suggestions[key];
  // A suggested DOT carries the year derived from it.
  if (q.id === 'dot' && suggestions.manufacturing_year !== undefined) {
    patch.manufacturing_year = suggestions.manufacturing_year;
  }
  return patch as Partial<TyreDraft>;
}
