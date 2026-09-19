import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private areas and auth flows must never be indexed.
        disallow: [
          '/*/mano',
          '/*/mano/*',
          '/*/naujas-skelbimas',
          '/*/prisijungti',
          '/*/registracija',
          '/*/slaptazodzio-atkurimas',
          '/*/naujas-slaptazodis',
          '/*/auth/*',
          '/auth/*',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
