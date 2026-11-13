import { Inter, Sora } from 'next/font/google';
import type { ReactNode } from 'react';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';

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

export function SiteDocument({ children, locale }: { children: ReactNode; locale: Locale }) {
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
