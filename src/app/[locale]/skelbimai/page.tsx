import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CatalogView } from '@/components/catalog/catalog-view';
import { parseFilters } from '@/domain/filters';
import { getDictionary } from '@/i18n';
import { LOCALES, isLocale } from '@/i18n/config';
import { routes } from '@/lib/routes';

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const dict = getDictionary(locale);

  return {
    title: dict.catalog.title,
    description: dict.catalog.descriptionAll,
    alternates: {
      // Filters stay out of the canonical URL so that every filter combination
      // does not become its own indexable duplicate.
      canonical: `/${locale}/skelbimai`,
      languages: Object.fromEntries(
        LOCALES.map((item) => [item, `/${item}/skelbimai`])
      ),
    },
  };
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const raw = await searchParams;
  const dict = getDictionary(locale);
  const filters = parseFilters(raw);

  return (
    <CatalogView
      filters={filters}
      locale={locale}
      basePath={routes.catalog(locale)}
      title={dict.catalog.title}
      subtitle={dict.catalog.descriptionAll}
    />
  );
}
