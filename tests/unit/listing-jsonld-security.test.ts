import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ListingPage from '@/app/[locale]/skelbimas/[slug]/page';
import { rowToListing } from '@/domain/listing.mapper';
import { listingRow } from '../integration/fixtures';

const repo = vi.hoisted(() => ({ fetchListingBySlug: vi.fn() }));
vi.mock('@/lib/repositories/listings', () => repo);
vi.mock('@/components/listing/gallery', () => ({ Gallery: () => null }));
vi.mock('@/components/listing/seller-contact', () => ({ SellerContact: () => null }));

afterEach(() => vi.unstubAllEnvs());

describe('listing structured data HTML boundary', () => {
  it.each(['title', 'description'] as const)(
    'keeps a closing script tag in %s inside the JSON payload',
    async (field) => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test');
      const payload = '</script><script>globalThis.__syntheticJsonLdProbe = 1</script>';
      const mapped = rowToListing(listingRow({ [field]: payload }), []);
      if (!mapped.ok) throw new Error(mapped.reason);
      const listing = mapped.listing;
      repo.fetchListingBySlug.mockResolvedValue({ ok: true, data: { listing, seller: {} } });
      const html = renderToStaticMarkup(await ListingPage({ params: Promise.resolve({ locale: 'en', slug: listing.slug }) }));
      expect(html.match(/<script\b/gi)).toHaveLength(1);
      const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
      expect(json).toBeDefined();
      const parsed = JSON.parse(json!);
      expect(parsed[field === 'title' ? 'name' : 'description']).toBe(payload);
      expect(json).not.toContain('<');
    }
  );
});
