import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TERMS_OF_USE } from '@/content/legal';
import { getDictionary, interpolate } from '@/i18n';
import { LOCALES, isLocale, type Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';

/** One sentence per language for the search result snippet. */
const DESCRIPTIONS: Readonly<Record<Locale, string>> = {
  lt: 'RATATAI skelbimų lentos naudojimosi taisyklės: skelbimų reikalavimai, atsakomybė ir saugaus pirkimo patarimai.',
  ru: 'Правила пользования доской объявлений RATATAI: требования к объявлениям, ответственность и советы по безопасной покупке.',
  en: 'The rules of the RATATAI classifieds board: listing requirements, responsibility and safe buying advice.',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const dict = getDictionary(locale);

  return {
    title: dict.legal.termsTitle,
    description: DESCRIPTIONS[locale],
    alternates: {
      canonical: `/${locale}/taisykles`,
      languages: Object.fromEntries(
        LOCALES.map((item) => [item, `/${item}/taisykles`])
      ),
    },
  };
}

export default async function TermsOfUsePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const terms = TERMS_OF_USE[locale];

  return (
    <div className="shell max-w-3xl py-10">
      <h1 className="text-3xl sm:text-4xl">{dict.legal.termsTitle}</h1>

      <p className="mt-3 text-sm text-ink-faint">
        {interpolate(dict.legal.lastUpdated, {
          date: formatDate(terms.lastUpdated, locale),
        })}
      </p>

      <p className="mt-6 text-base leading-relaxed text-ink-muted">{terms.intro}</p>

      {terms.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-xl sm:text-2xl">{section.heading}</h2>

          {section.paragraphs.map((paragraph, index) => (
            <p
              key={`${section.heading}-${index}`}
              className="mt-3 text-base leading-relaxed text-ink-muted"
            >
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
