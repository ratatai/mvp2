import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PRIVACY_POLICY } from '@/content/legal';
import { getDictionary, interpolate } from '@/i18n';
import { LOCALES, isLocale, type Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';

/** One sentence per language for the search result snippet. */
const DESCRIPTIONS: Readonly<Record<Locale, string>> = {
  lt: 'Kokius asmens duomenis RATATAI tvarko, kokiu pagrindu ir kokias teises turite pagal BDAR.',
  ru: 'Какие персональные данные обрабатывает RATATAI, на каком основании и какие права у вас есть по GDPR.',
  en: 'What personal data RATATAI processes, on what legal basis, and what rights you have under the GDPR.',
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
    title: dict.legal.privacyTitle,
    description: DESCRIPTIONS[locale],
    alternates: {
      canonical: `/${locale}/privatumo-politika`,
      languages: Object.fromEntries(
        LOCALES.map((item) => [item, `/${item}/privatumo-politika`])
      ),
    },
  };
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const policy = PRIVACY_POLICY[locale];

  return (
    <div className="shell max-w-3xl py-10">
      <h1 className="text-3xl sm:text-4xl">{dict.legal.privacyTitle}</h1>

      <p className="mt-3 text-sm text-ink-faint">
        {interpolate(dict.legal.lastUpdated, {
          date: formatDate(policy.lastUpdated, locale),
        })}
      </p>

      <p className="mt-6 text-base leading-relaxed text-ink-muted">{policy.intro}</p>

      {policy.sections.map((section) => (
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
