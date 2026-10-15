/**
 * Builds the listing texts and the site payload from a finished draft.
 *
 * The texts are assembled from templates, not written by a model: every
 * sentence states a value the seller confirmed, and a missing value simply
 * produces no sentence.
 */

import { parseListingDraft, formatTireSize, type DraftParseResult } from '../../../src/domain/listing.validation';
import type { TyreDraft, DraftKey } from './draft';
import { SITE_DICT, type Lang } from './i18n';

const SEASON_ADJ = {
  lt: { summer: 'vasarinės', winter: 'žieminės', all_season: 'visasezonės' },
  ru: { summer: 'летние', winter: 'зимние', all_season: 'всесезонные' },
} as const;

const CONDITION_ADJ = {
  lt: { new: 'Naujos', used: 'Naudotos' },
  ru: { new: 'Новые', used: 'Б/у' },
} as const;

export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'lt' ? 'lt-LT' : 'ru-RU', { maximumFractionDigits: 2 }).format(value);
}

function hasSize(d: TyreDraft): d is TyreDraft & { width: number; aspect_ratio: number; diameter: number } {
  return d.width !== undefined && d.aspect_ratio !== undefined && d.diameter !== undefined;
}

export function sizeText(d: TyreDraft): string | null {
  if (!hasSize(d)) return null;
  const service = d.load_index !== undefined && d.speed_index !== undefined ? ` ${d.load_index}${d.speed_index}` : '';
  return `${formatTireSize(d)}${service}`;
}

/** Human-readable value of one draft field, for confirmations and the summary. */
export function displayValue(key: DraftKey, d: Partial<TyreDraft>, lang: Lang): string | null {
  const dict = SITE_DICT[lang];
  const yesNo = (v: boolean | undefined) => (v === undefined ? null : v ? dict.form.yes : dict.form.no);
  switch (key) {
    case 'width':
    case 'aspect_ratio':
    case 'diameter':
      return hasSize(d) ? formatTireSize(d) : null;
    case 'load_index':
    case 'speed_index':
      return d.load_index !== undefined && d.speed_index !== undefined ? `${d.load_index}${d.speed_index}` : null;
    case 'season':
      return d.season === undefined ? null : dict.season[d.season];
    case 'condition':
      return d.condition === undefined ? null : dict.condition[d.condition];
    case 'sale_unit':
      return d.sale_unit === undefined ? null : dict.saleUnit[d.sale_unit];
    case 'xl':
    case 'run_flat':
    case 'studded':
      return yesNo(d[key]);
    case 'tread_depth':
      return d.tread_depth === undefined ? null : `${formatNumber(d.tread_depth, lang)} mm`;
    case 'price':
      return d.price === undefined ? null : `${formatNumber(d.price, lang)} €`;
    case 'quantity':
      return d.quantity === undefined ? null : `${d.quantity} ${lang === 'lt' ? 'vnt.' : 'шт.'}`;
    case 'dot':
      return d.dot === undefined
        ? null
        : d.manufacturing_year === undefined
          ? d.dot
          : `${d.dot} (${d.manufacturing_year})`;
    default: {
      const v = d[key];
      return v === undefined ? null : String(v);
    }
  }
}

export function buildTitle(d: TyreDraft, lang: Lang): string {
  const parts: string[] = [];
  if (lang === 'ru') parts.push('Шины');
  if (d.brand) parts.push(d.brand);
  if (d.model) parts.push(d.model);
  const size = hasSize(d) ? formatTireSize(d) : null;
  if (size) parts.push(size);
  if (d.season) parts.push(SEASON_ADJ[lang][d.season]);
  if (lang === 'lt') parts.push('padangos');
  let title = parts.join(' ');
  if (d.studded === true) title += lang === 'lt' ? ', dygliuotos' : ', шипованные';
  if (d.quantity !== undefined) title += `, ${d.quantity} ${lang === 'lt' ? 'vnt.' : 'шт.'}`;
  return title.length > 140 ? title.slice(0, 140).trimEnd() : title;
}

export function buildDescription(d: TyreDraft, lang: Lang): string {
  const lines: string[] = [];
  const nf = (v: number) => formatNumber(v, lang);
  const name = [d.brand, d.model].filter(Boolean).join(' ');
  const size = sizeText(d);

  if (lang === 'lt') {
    const cond = d.condition ? CONDITION_ADJ.lt[d.condition] : 'Parduodamos';
    const season = d.season ? ` ${SEASON_ADJ.lt[d.season]}` : '';
    lines.push(`${cond}${season} padangos ${name}${size ? `, ${size}` : ''}.`);
    if (d.quantity !== undefined) {
      const unit = d.sale_unit && d.quantity > 1 ? ` (${SITE_DICT.lt.saleUnit[d.sale_unit].toLowerCase()})` : '';
      lines.push(`Kiekis: ${d.quantity} vnt.${unit}`);
    }
    if (d.tread_depth !== undefined) lines.push(`Protektoriaus gylis: ${nf(d.tread_depth)} mm.`);
    if (d.manufacturing_year !== undefined) {
      lines.push(`Pagaminimo metai: ${d.manufacturing_year}${d.dot ? ` (DOT ${d.dot})` : ''}.`);
    } else if (d.dot) {
      lines.push(`DOT: ${d.dot}.`);
    }
    const features = [d.xl && 'XL (sustiprintos)', d.run_flat && 'Run Flat', d.studded && 'dygliuotos'].filter(Boolean);
    if (features.length > 0) lines.push(`Ypatybės: ${features.join(', ')}.`);
    if (d.defects) lines.push(`Defektai ir remontai: ${d.defects}`);
    if (d.price !== undefined) {
      lines.push(`Kaina: ${nf(d.price)} €${d.quantity !== undefined && d.quantity > 1 ? ` už visas ${d.quantity} vnt.` : ''}.`);
    }
    if (d.city) lines.push(`Vieta: ${d.city}.`);
  } else {
    const cond = d.condition ? CONDITION_ADJ.ru[d.condition] : 'Продаются';
    const season = d.season ? ` ${SEASON_ADJ.ru[d.season]}` : '';
    lines.push(`${cond}${season} шины ${name}${size ? `, ${size}` : ''}.`);
    if (d.quantity !== undefined) {
      const unit = d.sale_unit && d.quantity > 1 ? ` (${SITE_DICT.ru.saleUnit[d.sale_unit].toLowerCase()})` : '';
      lines.push(`Количество: ${d.quantity} шт.${unit}`);
    }
    if (d.tread_depth !== undefined) lines.push(`Глубина протектора: ${nf(d.tread_depth)} мм.`);
    if (d.manufacturing_year !== undefined) {
      lines.push(`Год выпуска: ${d.manufacturing_year}${d.dot ? ` (DOT ${d.dot})` : ''}.`);
    } else if (d.dot) {
      lines.push(`DOT: ${d.dot}.`);
    }
    const features = [d.xl && 'XL (усиленные)', d.run_flat && 'Run Flat', d.studded && 'шипованные'].filter(Boolean);
    if (features.length > 0) lines.push(`Особенности: ${features.join(', ')}.`);
    // Defects are free text in the language the seller (or the photo reader) used.
    if (d.defects) lines.push(`Дефекты и ремонты (как указано продавцом): ${d.defects}`);
    if (d.price !== undefined) {
      lines.push(`Цена: ${nf(d.price)} €${d.quantity !== undefined && d.quantity > 1 ? ` за все ${d.quantity} шт.` : ''}.`);
    }
    if (d.city) lines.push(`Город: ${d.city}.`);
  }
  return lines.join('\n');
}

/**
 * The payload the site's create form produces, validated by the site's own
 * schema (Lithuanian title/description — the canonical locale).
 */
export function toListingDraft(d: TyreDraft): DraftParseResult {
  const specs: Record<string, unknown> = {};
  const specKeys = [
    'brand', 'model', 'width', 'aspect_ratio', 'diameter', 'season', 'tread_depth',
    'manufacturing_year', 'dot', 'load_index', 'speed_index', 'xl', 'run_flat',
    'studded', 'defects', 'sale_unit',
  ] as const;
  for (const key of specKeys) {
    if (d[key] !== undefined) specs[key] = d[key];
  }
  return parseListingDraft({
    category: 'padangos',
    title: buildTitle(d, 'lt'),
    description: buildDescription(d, 'lt'),
    condition: d.condition,
    price: d.price,
    quantity: d.quantity,
    city: d.city,
    specs,
  });
}
