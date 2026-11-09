import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { SiteDocument } from '@/components/layout/site-document';
import { DEFAULT_LOCALE, REQUEST_LOCALE_HEADER, isLocale } from '@/i18n/config';

import LocaleNotFound from './[locale]/not-found';
import './globals.css';

export const metadata: Metadata = { robots: { index: false } };

export default async function GlobalNotFound() {
  const requestLocale = (await headers()).get(REQUEST_LOCALE_HEADER);
  const locale = isLocale(requestLocale) ? requestLocale : DEFAULT_LOCALE;

  return (
    <SiteDocument locale={locale}>
      <LocaleNotFound locale={locale} />
    </SiteDocument>
  );
}
