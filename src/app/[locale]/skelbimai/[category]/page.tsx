import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CatalogView } from '@/components/catalog/catalog-view';
import type { ListingCategory } from '@/domain/canonical';
import { parseFilters } from '@/domain/filters';
import { getDictionary, type Dictionary } from '@/i18n';
import { LOCALES, isLocale } from '@/i18n/config';
import { CATEGORY_SLUGS, categoryFromSlug, routes } from '@/lib/routes';

type SearchParams = Record<string, string | string[] | undefined>;

function describe(category: ListingCategory, dict: Dictionary): string {
  switch (category) {
    case 'padangos':
      return dict.catalog.descriptionTires;
    case 'ratlankiai':
      return dict.catalog.descriptionRims;
    case 'komplektiniai_ratai':
      return dict.catalog.descriptionWheels;
  }
}

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    Object.values(CATEGORY_SLUGS).map((category) => ({ locale, category }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}): Promise<Metadata> {
  const { locale, category: slug } = await params;
  if (!isLocale(locale)) return {};

  const category = categoryFromSlug(slug);
  if (category === null) return {};

  const dict = getDictionary(locale);

  return {
    title: dict.category[category],
    description: describe(category, dict),
    alternates: {
      canonical: `/${locale}/skelbimai/${slug}`,
      languages: Object.fromEntries(
        LOCALES.map((item) => [item, `/${item}/skelbimai/${slug}`])
      ),
    },
    openGraph: {
      title: `${dict.category[category]} — ${dict.common.siteName}`,
      description: describe(category, dict),
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; category: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, category: slug } = await params;
  if (!isLocale(locale)) notFound();

  const category = categoryFromSlug(slug);
  if (category === null) notFound();

  const raw = await searchParams;
  const dict = getDictionary(locale);

  // The route decides the category; a conflicting ?category= is ignored.
  const filters = { ...parseFilters(raw), category };

  return (
    <CatalogView
      filters={filters}
      locale={locale}
      basePath={routes.category(locale, category)}
      title={dict.category[category]}
      subtitle={describe(category, dict)}
    />
  );
}
