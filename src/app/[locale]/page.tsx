import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ListingGrid } from '@/components/listing/listing-grid';
import { EmptyState, SectionTitle } from '@/components/ui/states';
import {
  ArrowRightIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
  PhoneIcon,
} from '@/components/ui/icons';
import { LISTING_CATEGORIES } from '@/domain/canonical';
import { DEFAULT_FILTERS } from '@/domain/filters';
import { getDictionary } from '@/i18n';
import { LOCALES, isLocale } from '@/i18n/config';
import { getSiteUrl } from '@/lib/env';
import { fetchPublicListings } from '@/lib/repositories/listings';
import { routes } from '@/lib/routes';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const dict = getDictionary(locale);

  return {
    title: `${dict.common.siteName} — ${dict.common.tagline}`,
    description: dict.home.heroSubtitle,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(LOCALES.map((item) => [item, `/${item}`])),
    },
    openGraph: {
      title: `${dict.common.siteName} — ${dict.common.tagline}`,
      description: dict.home.heroSubtitle,
      url: `${getSiteUrl()}/${locale}`,
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const result = await fetchPublicListings({ ...DEFAULT_FILTERS });
  const latest = result.ok ? result.data.items.slice(0, 8) : [];

  const steps = [
    {
      icon: <UserIcon width={24} height={24} />,
      title: dict.home.howStep1Title,
      text: dict.home.howStep1Text,
    },
    {
      icon: <SearchIcon width={24} height={24} />,
      title: dict.home.howStep2Title,
      text: dict.home.howStep2Text,
    },
    {
      icon: <PhoneIcon width={24} height={24} />,
      title: dict.home.howStep3Title,
      text: dict.home.howStep3Text,
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="border-b border-line bg-gradient-to-b from-bg-alt to-bg">
        <div className="shell py-12 sm:py-16 lg:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">{dict.common.siteName}</p>
            <h1 className="text-[clamp(2rem,7vw,3.5rem)]">
              {dict.home.heroTitle}
            </h1>
            <p className="mt-4 max-w-xl text-base text-ink-muted sm:text-lg">
              {dict.home.heroSubtitle}
            </p>

            {/* Plain GET form: works before any JavaScript loads. */}
            <form
              action={routes.catalog(locale)}
              method="get"
              role="search"
              className="mt-7 flex flex-col gap-2.5 sm:flex-row"
            >
              <label htmlFor="hero-search" className="sr-only">
                {dict.filters.searchLabel}
              </label>
              <input
                id="hero-search"
                name="q"
                type="search"
                className="field flex-1"
                placeholder={dict.home.heroSearchPlaceholder}
              />
              <button type="submit" className="btn-primary sm:w-auto">
                <SearchIcon width={18} height={18} />
                {dict.common.search}
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={routes.catalog(locale)} className="btn-ghost">
                {dict.home.heroCta}
              </Link>
              <Link href={routes.createListing(locale)} className="btn-ghost">
                {dict.home.heroSecondaryCta}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="shell py-12">
        <SectionTitle
          eyebrow={dict.home.categoriesSubtitle}
          title={dict.home.categoriesTitle}
        />

        <ul className="grid gap-4 sm:grid-cols-3">
          {LISTING_CATEGORIES.map((category) => (
            <li key={category}>
              <Link
                href={routes.category(locale, category)}
                className="card flex min-h-touch items-center justify-between gap-3 p-6 hover:border-line-strong hover:bg-card-hover"
              >
                <span className="font-display text-lg font-bold">
                  {dict.category[category]}
                </span>
                <ArrowRightIcon className="text-brand" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Latest listings */}
      <section className="shell py-4 pb-12">
        <SectionTitle
          title={dict.home.latestTitle}
          subtitle={dict.home.latestSubtitle}
          action={
            <Link href={routes.catalog(locale)} className="btn-ghost text-sm">
              {dict.home.viewAll}
            </Link>
          }
        />

        {latest.length === 0 ? (
          <EmptyState
            title={dict.home.emptyTitle}
            text={dict.home.emptyText}
            action={{
              href: routes.createListing(locale),
              label: dict.nav.createListing,
            }}
          />
        ) : (
          <ListingGrid listings={latest} dict={dict} locale={locale} />
        )}
      </section>

      {/* How it works */}
      <section className="border-t border-line bg-bg-alt">
        <div className="shell py-12">
          <SectionTitle title={dict.home.howTitle} />
          <ul className="grid gap-4 sm:grid-cols-3">
            {steps.map((step) => (
              <li key={step.title} className="card p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  {step.icon}
                </div>
                <h3 className="mb-2 text-lg">{step.title}</h3>
                <p className="text-sm text-ink-muted">{step.text}</p>
              </li>
            ))}
          </ul>

          <p className="mt-8 flex items-start gap-2 text-sm text-ink-muted">
            <ShieldIcon width={18} height={18} className="mt-0.5 flex-none text-brand" />
            {dict.listing.safetyText}
          </p>
        </div>
      </section>
    </>
  );
}
