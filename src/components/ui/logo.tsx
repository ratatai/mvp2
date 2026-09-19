import Image from 'next/image';
import Link from 'next/link';

import type { Locale } from '@/i18n/config';
import { routes } from '@/lib/routes';
import { SITE } from '@/lib/site';

/**
 * The official RATATAI mark: the emblem from the live site plus the wordmark,
 * with the same red accent on the last three letters.
 */
export function Logo({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  return (
    <Link
      href={routes.home(locale)}
      aria-label={SITE.name}
      className="flex flex-none items-center gap-2.5"
    >
      <Image
        src="/logo.png"
        alt=""
        width={40}
        height={40}
        priority
        className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
      />
      {!compact && (
        <span className="font-display text-xl font-extrabold tracking-wide sm:text-2xl">
          {SITE.wordmark.lead}
          <span className="text-brand">{SITE.wordmark.accent}</span>
        </span>
      )}
    </Link>
  );
}
