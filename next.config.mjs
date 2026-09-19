/** @type {import('next').NextConfig} */

// Supabase Storage host is derived from the public URL so that next/image can
// optimise listing photos without hardcoding a project reference in the repo.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

/** @type {import('next').NextConfig['images']['remotePatterns']} */
const remotePatterns = [];

if (supabaseUrl) {
  try {
    const { hostname } = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: 'https',
      hostname,
      pathname: '/storage/v1/object/public/**',
    });
  } catch {
    // An invalid URL is reported by the runtime env validation in src/lib/env.ts.
  }
}

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
