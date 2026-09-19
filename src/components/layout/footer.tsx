import Link from 'next/link';

import { Logo } from '@/components/ui/logo';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { routes } from '@/lib/routes';
import { SITE } from '@/lib/site';
import { toTelHref } from '@/lib/format';

export function Footer({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-line bg-bg-alt">
      <div className="shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo locale={locale} />
          <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
            {dict.footer.about}
          </p>
        </div>

        <nav aria-label={dict.footer.sections}>
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-ink">
            {dict.footer.sections}
          </h2>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            <li>
              <Link href={routes.catalog(locale)} className="hover:text-ink">
                {dict.nav.catalog}
              </Link>
            </li>
            <li>
              <Link
                href={routes.category(locale, 'padangos')}
                className="hover:text-ink"
              >
                {dict.nav.tires}
              </Link>
            </li>
            <li>
              <Link
                href={routes.category(locale, 'ratlankiai')}
                className="hover:text-ink"
              >
                {dict.nav.rims}
              </Link>
            </li>
            <li>
              <Link
                href={routes.category(locale, 'komplektiniai_ratai')}
                className="hover:text-ink"
              >
                {dict.nav.wheels}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={dict.footer.legal}>
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-ink">
            {dict.footer.legal}
          </h2>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            <li>
              <Link href={routes.privacy(locale)} className="hover:text-ink">
                {dict.footer.privacy}
              </Link>
            </li>
            <li>
              <Link href={routes.terms(locale)} className="hover:text-ink">
                {dict.footer.terms}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="mb-4 font-display text-sm font-bold uppercase tracking-wider text-ink">
            {dict.footer.contacts}
          </h2>
          <ul className="space-y-2.5 text-sm text-ink-muted">
            <li>
              <a href={toTelHref(SITE.phoneDisplay)} className="hover:text-ink">
                {SITE.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={`mailto:${SITE.email}`} className="hover:text-ink">
                {SITE.email}
              </a>
            </li>
            <li>
              <a
                href={SITE.mapsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-ink"
              >
                {SITE.address}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="shell flex flex-col gap-2 py-5 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {SITE.name}. {dict.footer.rights}
          </p>
          <p>{dict.footer.openSource}</p>
        </div>
      </div>
    </footer>
  );
}
