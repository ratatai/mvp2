/**
 * SEO-friendly slugs.
 *
 * Lithuanian diacritics are transliterated so that URLs stay ASCII and stable,
 * and a short random suffix keeps slugs unique without a database round trip.
 */

const TRANSLITERATION: Readonly<Record<string, string>> = {
  ą: 'a',
  č: 'c',
  ę: 'e',
  ė: 'e',
  į: 'i',
  š: 's',
  ų: 'u',
  ū: 'u',
  ž: 'z',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
  я: 'ya',
};

export function slugifyText(value: string): string {
  const lowered = value.toLowerCase().trim();

  let out = '';
  for (const char of lowered) {
    const mapped = TRANSLITERATION[char];
    out += mapped !== undefined ? mapped : char;
  }

  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function randomSuffix(): string {
  const bytes = new Uint8Array(4);

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Builds a unique slug for a listing. Always ends with a random suffix so two
 * listings with the same title never collide on the unique index.
 */
export function buildListingSlug(title: string): string {
  const base = slugifyText(title);
  const stem = base.length > 0 ? base : 'skelbimas';
  return `${stem}-${randomSuffix()}`;
}

/** Extracts the id-like suffix so `/skelbimai/<slug>` lookups stay cheap. */
export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;
}
