'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { localeFromPathname, type Locale } from '@/i18n/config';
import { routes } from '@/lib/routes';

export interface NotFoundCopy {
  readonly title: string;
  readonly text: string;
  readonly goHome: string;
  readonly catalog: string;
}

/**
 * Body of the 404 page in the language of the requested URL.
 *
 * The not-found boundary gets no route params, but the path is known, and
 * its first segment is the locale. This runs during server rendering too, so
 * the HTML is already in the right language; only the four strings per
 * language are sent, not the dictionaries.
 */
export function NotFoundContent({
  copy,
}: {
  copy: Readonly<Record<Locale, NotFoundCopy>>;
}) {
  const locale = localeFromPathname(usePathname());
  const text = copy[locale];

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl">{text.title}</h1>
      <p className="max-w-md text-sm text-ink-muted">{text.text}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href={routes.home(locale)} className="btn-primary">
          {text.goHome}
        </Link>
        <Link href={routes.catalog(locale)} className="btn-ghost">
          {text.catalog}
        </Link>
      </div>
    </div>
  );
}
