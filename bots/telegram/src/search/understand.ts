/**
 * Language-model help for phrases the plain parser cannot handle — mostly
 * spoken ones: "двести пять пятьдесят пять шестнадцатый радиус зимние до
 * двухсот евро", "du šimtai penki penkiasdešimt penki R šešiolika".
 *
 * The model only proposes values; every value is range-checked here before it
 * is used, and the team always sees what was understood.
 */

import { postJson } from '../extraction/providers';
import type { SearchFilter } from '../store';

export interface Understanding {
  toFilter(phrase: string, knownBrands: readonly string[]): Promise<SearchFilter>;
  /** Rewrites a spoken answer into the written form a question expects. */
  normaliseAnswer(question: string, answer: string): Promise<string>;
}

const FILTER_SCHEMA = {
  type: 'object',
  properties: {
    width: { type: 'integer' },
    aspect_ratio: { type: 'integer' },
    diameter: { type: 'integer' },
    season: { type: 'string', enum: ['summer', 'winter', 'all_season'] },
    brand: { type: 'string' },
    model: { type: 'string' },
    studded: { type: 'boolean' },
    condition: { type: 'string', enum: ['new', 'used'] },
    min_quantity: { type: 'integer' },
    max_price: { type: 'number' },
    id: { type: 'integer' },
  },
  additionalProperties: false,
} as const;

const FILTER_PROMPT = `You turn a tyre-shop stock search (Lithuanian or Russian, often a
speech transcript with numbers spelled as words) into a search filter.
Include ONLY what the phrase actually asks for. Rules:
- "205/55 R16", "двести пять пятьдесят пять шестнадцать", "205 55 16" → width 205, aspect_ratio 55, diameter 16.
- "шестнадцатый радиус", "R16", "16 colių", "šešiolikos" → diameter 16.
- зимние/žieminės → winter; летние/vasarinės → summer; всесезонные/visasezonės → all_season.
- шипы/шипованные/dygliuotos → studded true; липучка/без шипов/be dyglių → studded false.
- новые/naujos → new; б/у/naudotos → used.
- "до 200 евро"/"iki 200" → max_price 200. "комплект"/"4 штуки" → min_quantity 4.
- brand: write it the standard way (Нокиан → Nokian, Мишлен → Michelin, Континенталь → Continental).
  Prefer the spelling from the team's brand list when it matches.
- "номер 12", "#12" → id 12.
Call the search tool once.`;

function intIn(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

/** Keeps only valid values from whatever the model returned. */
export function sanitiseFilter(raw: unknown): SearchFilter {
  if (typeof raw !== 'object' || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const filter: SearchFilter = {};
  const set = <K extends keyof SearchFilter>(key: K, value: SearchFilter[K] | undefined) => {
    if (value !== undefined) filter[key] = value;
  };
  set('id', intIn(r.id, 1, 10_000_000));
  set('width', intIn(r.width, 105, 405));
  set('aspect_ratio', intIn(r.aspect_ratio, 20, 95));
  set('diameter', intIn(r.diameter, 10, 26));
  if (r.season === 'summer' || r.season === 'winter' || r.season === 'all_season') filter.season = r.season;
  if (r.condition === 'new' || r.condition === 'used') filter.condition = r.condition;
  if (typeof r.studded === 'boolean') filter.studded = r.studded;
  if (typeof r.brand === 'string' && r.brand.trim().length > 0 && r.brand.length <= 60) filter.brand = r.brand.trim();
  if (typeof r.model === 'string' && r.model.trim().length > 0 && r.model.length <= 80) filter.model = r.model.trim();
  set('min_quantity', intIn(r.min_quantity, 1, 100));
  if (typeof r.max_price === 'number' && r.max_price > 0 && r.max_price <= 1_000_000) filter.max_price = r.max_price;
  if (filter.id !== undefined) return { id: filter.id, include_sold: true };
  return filter;
}

export function anthropicUnderstanding(options: { apiKey: string; model: string }): Understanding {
  const headers = { 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01' };
  const url = 'https://api.anthropic.com/v1/messages';

  return {
    async toFilter(phrase, knownBrands) {
      const data = (await postJson(url, headers, {
        model: options.model,
        max_tokens: 400,
        system: FILTER_PROMPT,
        tools: [{ name: 'search', description: 'Search the stock.', input_schema: FILTER_SCHEMA }],
        tool_choice: { type: 'tool', name: 'search' },
        messages: [
          {
            role: 'user',
            content: `Team's brands: ${knownBrands.join(', ') || '(none yet)'}\nPhrase: ${phrase}`,
          },
        ],
      })) as { content?: Array<{ type?: string; input?: unknown }> };
      return sanitiseFilter(data.content?.find((block) => block.type === 'tool_use')?.input);
    },

    async normaliseAnswer(question, answer) {
      const data = (await postJson(url, headers, {
        model: options.model,
        max_tokens: 200,
        system:
          'A tyre seller answered a question by voice; the answer is a speech transcript. ' +
          'Rewrite the answer in the short written form the question expects, with digits ' +
          '(e.g. "205/55 R16", "91V", "6,5", "160", "4521", "Vilnius", "Michelin"). ' +
          'Do not add anything that was not said. Reply with the rewritten answer only.',
        messages: [{ role: 'user', content: `Question: ${question}\nTranscript: ${answer}` }],
      })) as { content?: Array<{ type?: string; text?: string }> };
      const text = data.content?.find((block) => block.type === 'text')?.text ?? '';
      return text.trim().replace(/^["„“]|["“”]$/g, '');
    },
  };
}
