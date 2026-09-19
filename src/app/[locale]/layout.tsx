import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { LOCALES, isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { getSiteUrl } from '@/lib/env';

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-body',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  display: 'swap',
});

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

  const dict = getDictionary(locale);

  return (
    <html lang={locale} className={`${inter.variable} ${sora.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <a href="#main" className="skip-link">
          {dict.common.skipToContent}
        </a>
        <Header locale={locale} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
