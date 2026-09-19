import Link from 'next/link';
import { Suspense } from 'react';

import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { MobileNav, type NavLink } from '@/components/layout/mobile-nav';
import { PlusIcon, UserIcon } from '@/components/ui/icons';
import { Logo } from '@/components/ui/logo';
import { getDictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { routes } from '@/lib/routes';
import { getSessionUser } from '@/lib/supabase/server';

async function safeGetUser() {
  try {
    return await getSessionUser();
  } catch {
    // Missing configuration must not take the whole site down; the header
    // simply renders in its signed-out state.
    return null;
  }
}

export async function Header({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const user = await safeGetUser();

  const catalogLinks: readonly NavLink[] = [
    { href: routes.catalog(locale), label: dict.nav.catalog },
    { href: routes.category(locale, 'padangos'), label: dict.nav.tires },
    { href: routes.category(locale, 'ratlankiai'), label: dict.nav.rims },
    { href: routes.category(locale, 'komplektiniai_ratai'), label: dict.nav.wheels },
  ];

  const accountLinks: readonly NavLink[] =
    user === null
      ? [
          { href: routes.login(locale), label: dict.nav.login },
          { href: routes.register(locale), label: dict.nav.register },
        ]
      : [
          { href: routes.dashboard(locale), label: dict.nav.dashboard },
          { href: routes.myListings(locale), label: dict.nav.myListings },
          { href: routes.profile(locale), label: dict.nav.profile },
        ];

  return (
    <header className="sticky top-0 z-[60] border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="shell flex h-[68px] items-center justify-between gap-3">
        <Logo locale={locale} />

        <nav
          className="hidden items-center gap-7 lg:flex"
          aria-label={dict.nav.catalog}
        >
          {catalogLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-muted transition hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Suspense
            fallback={<span className="hidden h-11 w-20 sm:block" aria-hidden />}
          >
            <LanguageSwitcher locale={locale} label={dict.nav.language} />
          </Suspense>

          {user === null ? (
            <Link
              href={routes.login(locale)}
              className="btn-ghost hidden px-4 text-sm lg:inline-flex"
            >
              {dict.nav.login}
            </Link>
          ) : (
            <Link
              href={routes.dashboard(locale)}
              className="btn-ghost hidden px-4 text-sm lg:inline-flex"
            >
              <UserIcon width={18} height={18} />
              {dict.nav.dashboard}
            </Link>
          )}

          <Link
            href={routes.createListing(locale)}
            className="btn-primary hidden px-4 text-sm lg:inline-flex"
          >
            <PlusIcon width={18} height={18} />
            {dict.nav.createListing}
          </Link>

          <MobileNav
            links={catalogLinks}
            account={accountLinks}
            cta={{
              href: routes.createListing(locale),
              label: dict.nav.createListing,
            }}
            openLabel={dict.nav.openMenu}
            closeLabel={dict.nav.closeMenu}
          />
        </div>
      </div>
    </header>
  );
}
