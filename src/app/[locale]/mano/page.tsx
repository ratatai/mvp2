import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { signOutAction } from '@/app/actions/auth';
import { PlusIcon, UserIcon } from '@/components/ui/icons';
import { getDictionary } from '@/i18n';
import { isLocale } from '@/i18n/config';
import { fetchOwnerListings } from '@/lib/repositories/listings';
import { routes } from '@/lib/routes';
import { getSessionUser } from '@/lib/supabase/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const user = await getSessionUser();
  if (user === null) {
    redirect(
      `${routes.login(locale)}?next=${encodeURIComponent(routes.dashboard(locale))}`
    );
  }

  const dict = getDictionary(locale);
  const result = await fetchOwnerListings(user.id);
  const listings = result.ok ? result.data : [];

  const counts = {
    active: listings.filter((item) => item.status === 'active').length,
    draft: listings.filter((item) => item.status === 'draft').length,
    sold: listings.filter((item) => item.status === 'sold').length,
  };

  const tiles = [
    { label: dict.dashboard.statusActive, value: counts.active },
    { label: dict.dashboard.statusDraft, value: counts.draft },
    { label: dict.dashboard.statusSold, value: counts.sold },
  ];

  return (
    <div className="shell py-8 sm:py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">{dict.dashboard.title}</h1>

        {/* Plain form: signing out works without JavaScript. */}
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="btn-ghost text-sm">
            {dict.nav.logout}
          </button>
        </form>
      </div>

      <ul className="mb-8 grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.label} className="card p-5">
            <p className="text-sm text-ink-muted">{tile.label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold">
              {tile.value}
            </p>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href={routes.createListing(locale)}
          className="card flex min-h-touch items-center gap-3 p-5 hover:border-line-strong hover:bg-card-hover"
        >
          <PlusIcon className="text-brand" />
          <span className="font-display font-bold">{dict.nav.createListing}</span>
        </Link>

        <Link
          href={routes.myListings(locale)}
          className="card flex min-h-touch items-center gap-3 p-5 hover:border-line-strong hover:bg-card-hover"
        >
          <span className="font-display font-bold">{dict.nav.myListings}</span>
        </Link>

        <Link
          href={routes.profile(locale)}
          className="card flex min-h-touch items-center gap-3 p-5 hover:border-line-strong hover:bg-card-hover"
        >
          <UserIcon className="text-brand" />
          <span className="font-display font-bold">{dict.nav.profile}</span>
        </Link>
      </div>
    </div>
  );
}
