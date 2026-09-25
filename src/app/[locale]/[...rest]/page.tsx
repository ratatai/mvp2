import { notFound } from 'next/navigation';

/**
 * Catches every path under a locale that no other route matches.
 *
 * [locale]/not-found.tsx is only used when a page inside [locale] calls
 * notFound(); an unmatched URL would otherwise fall through to Next's built-in
 * English 404, outside the site layout. Routing it here keeps the header,
 * footer and translated text, with a 404 status.
 */
export default function UnknownRoute() {
  notFound();
}
