import { describe, expect, it } from 'vitest';
import { matchRemotePattern } from 'next/dist/shared/lib/match-remote-pattern';

import {
  STORAGE_PUBLIC_PATHNAME,
  supabaseStorageImagePattern,
  type StorageImagePattern,
} from '@/lib/supabase/storage-image-pattern.mjs';

/*
 * The assertions go through Next's own matcher, so they test what next/image
 * will actually allow, not a re-implementation of it.
 */

const PHOTO = '/storage/v1/object/public/listing-images/u/l/photo.webp';

function allows(pattern: StorageImagePattern | null, href: string): boolean {
  return pattern !== null && matchRemotePattern({ ...pattern }, new URL(href));
}

describe('supabaseStorageImagePattern', () => {
  describe('hosted project (https)', () => {
    const host = 'abcdefghijklmnop.supabase.co';
    const pattern = supabaseStorageImagePattern(`https://${host}`);

    it('stays https on the default port', () => {
      expect(pattern).toEqual({
        protocol: 'https',
        hostname: host,
        port: '',
        pathname: STORAGE_PUBLIC_PATHNAME,
      });
    });

    it('allows public Storage photos and nothing else', () => {
      expect(allows(pattern, `https://${host}${PHOTO}`)).toBe(true);
      expect(allows(pattern, `http://${host}${PHOTO}`)).toBe(false);
      expect(allows(pattern, `https://${host}:8443${PHOTO}`)).toBe(false);
      expect(allows(pattern, `https://other.supabase.co${PHOTO}`)).toBe(false);
      expect(
        allows(pattern, `https://${host}/storage/v1/object/sign/listing-images/a.webp`)
      ).toBe(false);
    });
  });

  describe('local stack (http://127.0.0.1:54321)', () => {
    const pattern = supabaseStorageImagePattern('http://127.0.0.1:54321');

    it('uses exactly that protocol, host and port', () => {
      expect(pattern).toEqual({
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: STORAGE_PUBLIC_PATHNAME,
      });
    });

    it('allows only that host and port', () => {
      expect(allows(pattern, `http://127.0.0.1:54321${PHOTO}`)).toBe(true);
      expect(allows(pattern, `https://127.0.0.1:54321${PHOTO}`)).toBe(false);
      expect(allows(pattern, `http://127.0.0.1:54322${PHOTO}`)).toBe(false);
      expect(allows(pattern, `http://127.0.0.1${PHOTO}`)).toBe(false);
      expect(allows(pattern, `http://localhost:54321${PHOTO}`)).toBe(false);
      expect(allows(pattern, `http://10.0.0.1:54321${PHOTO}`)).toBe(false);
    });
  });

  it('gives no pattern for http outside loopback, other schemes or a missing URL', () => {
    for (const value of [
      'http://abcdefghijklmnop.supabase.co',
      'ftp://127.0.0.1',
      'not a url',
      '',
      '   ',
      undefined,
    ]) {
      expect(supabaseStorageImagePattern(value)).toBeNull();
    }
  });
});
