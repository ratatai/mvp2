import type { MetadataRoute } from 'next';

import { LOCALES } from '@/i18n/config';
import { getSiteUrl } from '@/lib/env';
import { fetchPublicSlugs } from '@/lib/repositories/listings';
import { CATEGORY_SLUGS } from '@/lib/routes';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticPaths = [
    '',
    '/skelbimai',
    ...Object.values(CATEGORY_SLUGS).map((slug) => `/skelbimai/${slug}`),
    '/privatumo-politika',
    '/taisykles',
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    for (const path of staticPaths) {
      entries.push({
        url: `${base}/${locale}${path}`,
        lastModified: now,
        changeFrequency: path === '' ? 'daily' : 'hourly',
        priority: path === '' ? 1 : 0.8,
      });
    }
  }

  // Public listings. Auth and dashboard routes are deliberately absent.
  const listings = await fetchPublicSlugs();

  for (const listing of listings) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${base}/${locale}/skelbimas/${listing.slug}`,
        lastModified: new Date(listing.updated_at),
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  }

  return entries;
}
