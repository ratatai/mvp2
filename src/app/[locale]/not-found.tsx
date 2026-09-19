import Link from 'next/link';

import { DEFAULT_LOCALE } from '@/i18n/config';
import { getDictionary } from '@/i18n';
import { routes } from '@/lib/routes';

/**
 * Locale-scoped 404. It cannot read params, so it renders in the default
 * language — which is Lithuanian, the site's primary language.
 */
export default function LocaleNotFound() {
  const dict = getDictionary(DEFAULT_LOCALE);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl">{dict.errors.notFoundTitle}</h1>
      <p className="max-w-md text-sm text-ink-muted">{dict.errors.notFoundText}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href={routes.home(DEFAULT_LOCALE)} className="btn-primary">
          {dict.errors.goHome}
        </Link>
        <Link href={routes.catalog(DEFAULT_LOCALE)} className="btn-ghost">
          {dict.nav.catalog}
        </Link>
      </div>
    </div>
  );
}
