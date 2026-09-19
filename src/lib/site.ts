/**
 * Static brand and contact data, taken from the live RATATAI site.
 * Keeping it in one place means a phone number change is a one-line edit.
 */

export const SITE = {
  name: 'RATATAI',
  /** The wordmark is rendered as "RATA" + a red "TAI", as on ratatai.com. */
  wordmark: { lead: 'RATA', accent: 'TAI' },
  phoneDisplay: '+370 643 95480',
  phoneRaw: '+37064395480',
  whatsapp: '37064395480',
  email: 'ratatailt@gmail.com',
  address: 'Gariūnų g. 43 / EP31, Vilnius',
  mapsUrl: 'https://maps.app.goo.gl/2w8uhEXYdHJXTvr38',
  repositoryUrl: 'https://github.com/',
} as const;

/** Cities offered as quick suggestions in the city field. Not a closed list. */
export const LT_CITY_SUGGESTIONS = [
  'Vilnius',
  'Kaunas',
  'Klaipėda',
  'Šiauliai',
  'Panevėžys',
  'Alytus',
  'Marijampolė',
  'Mažeikiai',
  'Jonava',
  'Utena',
] as const;
