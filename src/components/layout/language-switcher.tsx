'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
  type Locale,
} from '@/i18n/config';
import { withLocale } from '@/lib/routes';
import { ChevronDownIcon, GlobeIcon } from '@/components/ui/icons';

/**
 * Language switcher.
 *
 * Switching keeps the visitor on the same page with the same filters — only
 * the locale segment changes — and stores the choice in a cookie so the next
 * visit opens in the same language.
 */
export function LanguageSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function switchTo(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;

    const query = searchParams.toString();
    const target = withLocale(pathname, next);

    setOpen(false);
    router.push(query.length > 0 ? `${target}?${query}` : target);
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="btn-ghost min-h-touch px-3 text-sm"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <GlobeIcon width={18} height={18} />
        <span>{LOCALE_SHORT_LABELS[locale]}</span>
        <ChevronDownIcon width={16} height={16} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-line bg-card shadow-card"
        >
          {LOCALES.map((item) => (
            <li key={item}>
              <button
                type="button"
                role="option"
                aria-selected={item === locale}
                onClick={() => switchTo(item)}
                className={`flex min-h-touch w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-card-hover ${
                  item === locale ? 'text-brand' : 'text-ink'
                }`}
              >
                <span>{LOCALE_LABELS[item]}</span>
                <span className="text-xs text-ink-faint">
                  {LOCALE_SHORT_LABELS[item]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
