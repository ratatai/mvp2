/**
 * Turns a search phrase ("205/55 R16 žieminės Nokian", "зимние шипы 16 радиус
 * до 200") into a structured filter, without any model. Words it does not
 * recognise are returned as `leftover`, so the caller can decide to ask the
 * language model instead.
 */

import { parseTyreSize } from '../parse';
import { foldText, type SearchFilter } from '../store';
import { SITE_DICT, type Lang } from '../i18n';

/** Words that carry no search meaning ("find", "tyres", "do you have"...). */
const STOP_WORDS = new Set(
  [
    // lt
    'padangos', 'padangu', 'padanga', 'padangas', 'rask', 'rasti', 'ieskau', 'ieskoti', 'ar', 'turim', 'turime',
    'yra', 'kokios', 'reikia', 'man', 'su', 'ir', 'vnt', 'skersmuo', 'colio', 'coliu', 'dydis', 'r',
    // ru
    'шины', 'шина', 'шин', 'резина', 'резину', 'найди', 'найти', 'поиск', 'покажи', 'есть', 'ли', 'у', 'нас',
    'какие', 'нужны', 'нужно', 'мне', 'с', 'и', 'шт', 'штук', 'радиус', 'радиусе', 'размер', 'на', 'r',
    // en
    'tyres', 'tires', 'tyre', 'tire', 'find', 'search', 'show',
  ].map(foldText)
);

const SEASON_PATTERNS: readonly [RegExp, NonNullable<SearchFilter['season']>][] = [
  [/^(visasezon|всесезон|all ?season|allseason|4 ?season)/, 'all_season'],
  [/^(vasar|летн|лето|summer)/, 'summer'],
  [/^(ziem|зимн|зима|winter)/, 'winter'],
];

export interface ParsedQuery {
  readonly filter: SearchFilter;
  /** Words that were not understood. */
  readonly leftover: readonly string[];
}

export function parseQuery(raw: string, knownBrands: readonly string[]): ParsedQuery {
  const filter: SearchFilter = {};
  // "б/у" would be split by the slash; make it one word first.
  let text = ` ${raw.trim().replace(/б\s*\/\s*у/giu, ' бу ')} `;

  const id = /(?:^|\s)(?:#|nr\.?\s*|№\s*)(\d{1,7})(?=\s|$)/i.exec(text);
  if (id) return { filter: { id: Number(id[1]), include_sold: true }, leftover: [] };

  // Full size anywhere in the phrase.
  const sizeMatch = /(\d{3})\s*[/\s]\s*(\d{2})\s*(?:z?r\s*f?|-)?\s*(\d{2})(?=\D|$)/i.exec(text);
  const size = sizeMatch ? parseTyreSize(`${sizeMatch[1]}/${sizeMatch[2]} R${sizeMatch[3]}`) : null;
  if (sizeMatch && size) {
    Object.assign(filter, size);
    text = text.replace(sizeMatch[0], ' ');
  } else {
    const wa = /(?:^|\s)(\d{3})\s*\/\s*(\d{2})(?=\s|$)/.exec(text);
    if (wa) {
      filter.width = Number(wa[1]);
      filter.aspect_ratio = Number(wa[2]);
      text = text.replace(wa[0], ' ');
    }
    const dia = /(?:^|\s)(?:r\s*(\d{2})|(\d{2})\s*(?:r|colio|coli[uų]|радиус\w*|дюйм\w*|"|''))(?=\s|$)/i.exec(text);
    if (dia) {
      const value = Number(dia[1] ?? dia[2]);
      if (value >= 10 && value <= 26) {
        filter.diameter = value;
        text = text.replace(dia[0], ' ');
      }
    }
  }

  const maxPrice = /(?:iki|до|<|max|ne daugiau nei)\s*(\d+(?:[.,]\d+)?)\s*(?:€|eur\w*|евро)?/i.exec(text);
  if (maxPrice) {
    filter.max_price = Number((maxPrice[1] ?? '').replace(',', '.'));
    text = text.replace(maxPrice[0], ' ');
  }

  const qty = /(\d{1,3})\s*(?:vnt\.?|шт\.?|штук\w*|pcs)/i.exec(text);
  if (qty) {
    filter.min_quantity = Number(qty[1]);
    text = text.replace(qty[0], ' ');
  }

  const leftover: string[] = [];
  const brandsByFold = new Map(knownBrands.map((brand) => [foldText(brand), brand]));

  const words = foldText(text).split(' ').filter(Boolean);
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i] ?? '';
    const pair = i + 1 < words.length ? `${word} ${words[i + 1]}` : '';

    // Two-word brands first ("bf goodrich").
    if (pair && brandsByFold.has(pair)) {
      filter.brand = brandsByFold.get(pair);
      i += 1;
      continue;
    }
    if (brandsByFold.has(word)) {
      filter.brand = brandsByFold.get(word);
      continue;
    }
    const season = SEASON_PATTERNS.find(([pattern]) => pattern.test(word));
    if (season) {
      filter.season = season[1];
      continue;
    }
    if (/^(be|без|ne|не)$/.test(word) && /^(dygli|шип)/.test(words[i + 1] ?? '')) {
      filter.studded = false;
      i += 1;
      continue;
    }
    if (/^(nedygliuot|нешип|липучк|frikcin|friction)/.test(word)) {
      filter.studded = false;
      continue;
    }
    if (/^(dygliuot|dygli|шип|studd)/.test(word)) {
      filter.studded = true;
      continue;
    }
    if (/^(nauj|нов|new)/.test(word)) {
      filter.condition = 'new';
      continue;
    }
    if (/^(naudot|бу|used|ношен)/.test(word)) {
      filter.condition = 'used';
      continue;
    }
    if (/^(komplekt|комплект|set)/.test(word)) {
      filter.min_quantity ??= 4;
      continue;
    }
    if (/^(pora|пара|pair)$/.test(word)) {
      filter.min_quantity ??= 2;
      continue;
    }
    if (STOP_WORDS.has(word)) continue;
    leftover.push(word);
  }

  // Unknown words may be a model name or a brand not yet in stock.
  if (leftover.length > 0) filter.text = leftover.join(' ');
  return { filter, leftover };
}

/** "205/55 R16 · žieminės · Nokian" — shown so the team sees what was understood. */
export function describeFilter(filter: SearchFilter, lang: Lang): string {
  const dict = SITE_DICT[lang];
  const parts: string[] = [];
  if (filter.id !== undefined) return `#${filter.id}`;
  if (filter.width !== undefined && filter.aspect_ratio !== undefined && filter.diameter !== undefined) {
    parts.push(`${filter.width}/${filter.aspect_ratio} R${filter.diameter}`);
  } else {
    if (filter.width !== undefined && filter.aspect_ratio !== undefined) parts.push(`${filter.width}/${filter.aspect_ratio}`);
    else if (filter.width !== undefined) parts.push(`${filter.width}/…`);
    if (filter.diameter !== undefined) parts.push(`R${filter.diameter}`);
  }
  if (filter.season) parts.push(dict.season[filter.season].toLowerCase());
  if (filter.studded !== undefined) {
    parts.push(
      filter.studded
        ? dict.specs.studded.toLowerCase()
        : lang === 'lt' ? 'be dyglių' : 'без шипов'
    );
  }
  if (filter.brand) parts.push(filter.brand);
  if (filter.model) parts.push(filter.model);
  if (filter.condition) parts.push(dict.condition[filter.condition].toLowerCase());
  if (filter.min_quantity !== undefined) parts.push(`≥ ${filter.min_quantity} ${lang === 'lt' ? 'vnt.' : 'шт.'}`);
  if (filter.max_price !== undefined) parts.push(`${lang === 'lt' ? 'iki' : 'до'} ${filter.max_price} €`);
  if (filter.text) parts.push(`„${filter.text}“`);
  return parts.length > 0 ? parts.join(' · ') : lang === 'lt' ? 'visos pozicijos' : 'все позиции';
}
