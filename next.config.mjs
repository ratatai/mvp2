/** @type {import('next').NextConfig} */

import { supabaseStorageImagePattern } from './src/lib/supabase/storage-image-pattern.mjs';

// Protocol, host and port of Supabase Storage are derived from the public URL,
// so next/image can optimise listing photos without hardcoding a project
// reference: https on the default port for a hosted project, exactly
// http://127.0.0.1:54321 for the local stack used by E2E.
const storagePattern = supabaseStorageImagePattern(
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

/** @type {import('next').NextConfig['images']['remotePatterns']} */
const remotePatterns = storagePattern === null ? [] : [{ ...storagePattern }];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns,
    formats: ['image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
