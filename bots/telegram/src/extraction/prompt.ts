/**
 * Instructions and output schema shared by every vision provider.
 */

export const SYSTEM_PROMPT = `You read tyre sidewalls from photos for a used-tyre classifieds site.
Report ONLY what you can actually see. Never fill a field from typical values,
from what "usually" goes with a size, or from the price of a similar tyre.

For each field return { value, confidence, evidence }:
- confidence "high": the marking is clearly legible on at least one photo and
  you would bet on it. "low": partly legible, blurry, inferred, or conflicting
  between photos. If you cannot see it at all, value = null, confidence "low".
- evidence: a few words, e.g. "sidewall, photo 2", "tread gauge on photo 4".

Field rules:
- brand: manufacturer as printed (Michelin, Nokian, Continental...).
- model: tread line as printed (Primacy 4, Hakkapeliitta R5, WinterContact TS 860).
- size: exactly as printed, e.g. "205/55 R16". If the digits are hard to read, confidence "low".
- service_description: load + speed index next to the size, e.g. "91V" or "102/100T".
- season: "winter" for clear winter tyres (snowflake-on-mountain 3PMSF symbol on a
  winter tread line, studs, winter model names such as Alpin, Hakkapeliitta,
  WinterContact, Blizzak). "all_season" for all-season lines (CrossClimate,
  Vector 4Seasons, QuatracLite...). M+S alone is NOT enough for winter. 3PMSF also
  appears on all-season tyres, so use the model line. Use "high" only when the
  model line or markings make the season unambiguous.
- dot: the full DOT marking as printed. The last 4 digits are week+year (e.g. 4521).
  If those 4 digits are not fully legible, confidence "low".
- xl: true if XL, EXTRA LOAD or REINFORCED is printed. false only if you can see the
  area next to the size clearly and there is no such marking; otherwise null.
- run_flat: true if RFT, ROF, RUN FLAT, RunOnFlat, SSR, ZP, DSST, EMT, HRS or the
  BMW star-with-RSC is printed; otherwise null unless you are sure it is absent.
- studded: true if metal studs are visible in the tread; false if the tread is
  clearly visible and has no studs or stud holes.
- tread_depth: ONLY if a tread depth gauge or ruler with a readable value is
  visible. Never estimate tread depth by eye.
- condition: "new" only with clear signs (stickers/labels, moulding nubs/vent spurs
  intact everywhere, no wear). Otherwise "used" with confidence "low".
- defects: describe visible damage (cuts, bulges, cracks, patches, plugs) in one
  short sentence IN LITHUANIAN. null if none visible. Do not invent damage.
- tyres_visible: how many separate tyres appear across the photos.
- mixed_tyres: true if the photos clearly show different sizes or models.
- is_tyre_photo: false if the photos do not show tyres.

Call the report_tyre tool exactly once.`;

const reading = (valueSchema: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    value: { anyOf: [valueSchema, { type: 'null' }] },
    confidence: { type: 'string', enum: ['high', 'low'] },
    evidence: { type: 'string' },
  },
  required: ['value', 'confidence'],
  additionalProperties: false,
});

export const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    is_tyre_photo: { type: 'boolean' },
    mixed_tyres: { type: 'boolean' },
    tyres_visible: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    brand: reading({ type: 'string' }),
    model: reading({ type: 'string' }),
    size: reading({ type: 'string' }),
    service_description: reading({ type: 'string' }),
    season: reading({ type: 'string', enum: ['summer', 'winter', 'all_season'] }),
    dot: reading({ type: 'string' }),
    xl: reading({ type: 'boolean' }),
    run_flat: reading({ type: 'boolean' }),
    studded: reading({ type: 'boolean' }),
    tread_depth: reading({ type: 'number' }),
    condition: reading({ type: 'string', enum: ['new', 'used'] }),
    defects: reading({ type: 'string' }),
  },
  required: [
    'is_tyre_photo',
    'brand',
    'model',
    'size',
    'service_description',
    'season',
    'dot',
    'xl',
    'run_flat',
    'studded',
    'tread_depth',
    'condition',
    'defects',
  ],
  additionalProperties: false,
} as const;

export const USER_INSTRUCTION =
  'These photos show the tyre(s) for one listing. Read the markings and call report_tyre.';
