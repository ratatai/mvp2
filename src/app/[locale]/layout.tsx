import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { SiteDocument } from '@/components/layout/site-document';
import { LOCALES, isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { getSiteUrl } from '@/lib/env';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  width: 'device-width',
  initialScale: 1,
  // Zoom is deliberately left unrestricted: pinch-to-zoom must keep working.
  maximumScale: 5,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const dict = getDictionary(locale);
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${dict.common.siteName} — ${dict.common.tagline}`,
      template: `%s — ${dict.common.siteName}`,
    },
    description: dict.catalog.descriptionAll,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        LOCALES.map((item) => [item, `/${item}`])
      ),
    },
    openGraph: {
      type: 'website',
      siteName: dict.common.siteName,
      title: `${dict.common.siteName} — ${dict.common.tagline}`,
      description: dict.catalog.descriptionAll,
      locale,
      url: `${siteUrl}/${locale}`,
    },
    icons: { icon: '/favicon.png' },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) notFound();

  return <SiteDocument locale={locale}>{children}</SiteDocument>;
}
