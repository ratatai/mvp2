import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ListingPage, { generateMetadata } from '@/app/[locale]/skelbimas/[slug]/page';
import { getDictionary } from '@/i18n';
import type { RepoError, RepoResult } from '@/lib/repositories/listings';

const NOT_FOUND = 'NEXT_NOT_FOUND_SENTINEL';
const SECRET = 'SECRET_DB_MESSAGE relation "listings" NEXT_PUBLIC_SUPABASE_ANON_KEY';

const repo = vi.hoisted(() => ({ fetchListingBySlug: vi.fn() }));
const nav = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND_SENTINEL');
  }),
}));

vi.mock('@/lib/repositories/listings', () => repo);
vi.mock('next/navigation', () => nav);
// The page is only exercised up to its routing decision; UI components are
// irrelevant here and are replaced to keep the test free of client code.
vi.mock('@/components/listing/gallery', () => ({ Gallery: () => null }));
vi.mock('@/components/listing/seller-contact', () => ({ SellerContact: () => null }));

type Result = RepoResult<unknown>;

function failure(error: RepoError): Result {
  return { ok: false, error };
}

function params(locale: string, slug = 'some-slug') {
  return { params: Promise.resolve({ locale, slug }) };
}

const listing = {
  slug: 'some-slug',
  title: 'Michelin Pilot Sport 4 225/45 R17',
  description: 'Synthetic listing description used only by this unit test.',
  images: [],
};

const MISSING_CODES = [
  'not_found',
  'forbidden',
  'validation',
  'not_authenticated',
  'conflict',
] as const satisfies readonly RepoError[];

describe('skelbimas/[slug] routing of repository results', () => {
  beforeEach(() => {
    repo.fetchListingBySlug.mockReset();
    nav.notFound.mockClear();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('unavailable', () => {
    beforeEach(() => {
      repo.fetchListingBySlug.mockResolvedValue(failure('unavailable'));
    });

    it.each(['lt', 'ru', 'en'] as const)(
      'generateMetadata (%s) rejects with the fixed generic error',
      async (locale) => {
        const promise = generateMetadata(params(locale));
        await expect(promise).rejects.toThrow(/^listing_unavailable$/);
        const error = await promise.catch((e: unknown) => e);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('listing_unavailable');
        expect((error as Error & { digest?: unknown }).digest).toBeUndefined();
        expect(nav.notFound).not.toHaveBeenCalled();
      }
    );

    it.each(['lt', 'ru', 'en'] as const)(
      'page (%s) rejects with the fixed generic error and does not call notFound',
      async (locale) => {
        const error = await ListingPage(params(locale)).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('listing_unavailable');
        expect((error as Error).message).not.toBe(NOT_FOUND);
        expect(nav.notFound).not.toHaveBeenCalled();
      }
    );

    it('never surfaces a repository or environment detail', async () => {
      // Even if a raw message were somehow attached to the result, the thrown
      // error must stay fixed.
      repo.fetchListingBySlug.mockResolvedValue({
        ok: false,
        error: 'unavailable',
        message: SECRET,
      });
      const errors = await Promise.all([
        generateMetadata(params('en')).catch((e: unknown) => e),
        ListingPage(params('en')).catch((e: unknown) => e),
      ]);
      for (const error of errors) {
        const serialized = `${String(error)} ${JSON.stringify(error)} ${(error as Error).stack ?? ''}`;
        expect(serialized).not.toContain('SECRET_DB_MESSAGE');
        expect(serialized).not.toContain('NEXT_PUBLIC_SUPABASE');
        expect((error as Error).message).toBe('listing_unavailable');
      }
    });
  });

  describe.each(MISSING_CODES)('%s keeps the missing-listing behavior', (code) => {
    beforeEach(() => {
      repo.fetchListingBySlug.mockResolvedValue(failure(code));
    });

    it.each(['lt', 'ru', 'en'] as const)(
      'generateMetadata (%s) returns the localized not-found title with noindex',
      async (locale) => {
        const metadata = await generateMetadata(params(locale));
        expect(metadata).toEqual({
          title: getDictionary(locale).listing.notFoundTitle,
          robots: { index: false },
        });
        expect(nav.notFound).not.toHaveBeenCalled();
      }
    );

    it('page calls notFound', async () => {
      await expect(ListingPage(params('lt'))).rejects.toThrow(NOT_FOUND);
      expect(nav.notFound).toHaveBeenCalledTimes(1);
    });
  });

  it('pins the localized not-found titles', () => {
    expect(getDictionary('lt').listing.notFoundTitle).toBe('Skelbimas nerastas');
    expect(getDictionary('ru').listing.notFoundTitle).toBe('Объявление не найдено');
    expect(getDictionary('en').listing.notFoundTitle).toBe('Listing not found');
  });

  it('success metadata still uses the listing data', async () => {
    repo.fetchListingBySlug.mockResolvedValue({
      ok: true,
      data: { listing, seller: null },
    });
    const metadata = await generateMetadata(params('en'));
    expect(metadata.title).toBe(listing.title);
    expect(metadata.description).toBe(listing.description);
    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates?.canonical).toBe('/en/skelbimas/some-slug');
    expect(metadata.openGraph?.url).toBe('https://example.test/en/skelbimas/some-slug');
    expect(nav.notFound).not.toHaveBeenCalled();
  });

  it('an unknown locale does not reach the repository', async () => {
    await expect(generateMetadata(params('de'))).resolves.toEqual({});
    await expect(ListingPage(params('de'))).rejects.toThrow(NOT_FOUND);
    expect(repo.fetchListingBySlug).not.toHaveBeenCalled();
  });
});
