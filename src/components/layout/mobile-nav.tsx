'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CloseIcon, MenuIcon } from '@/components/ui/icons';

export interface NavLink {
  readonly href: string;
  readonly label: string;
}

/**
 * Mobile navigation drawer.
 *
 * Closes on Escape and on navigation, traps nothing else on the page while
 * open, and locks body scrolling so the drawer itself is what scrolls.
 */
export function MobileNav({
  links,
  cta,
  account,
  openLabel,
  closeLabel,
}: {
  links: readonly NavLink[];
  cta: NavLink;
  account: readonly NavLink[];
  openLabel: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost min-h-touch min-w-touch px-3 lg:hidden"
        aria-label={openLabel}
        aria-expanded={open}
      >
        <MenuIcon />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-bg lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={openLabel}
        >
          <div className="flex h-[68px] flex-none items-center justify-end px-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost min-h-touch min-w-touch px-3"
              aria-label={closeLabel}
              autoFocus
            >
              <CloseIcon />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 pb-8">
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex min-h-touch items-center border-b border-line py-4 font-display text-lg font-semibold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <ul className="mt-2 flex flex-col">
              {account.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex min-h-touch items-center border-b border-line py-4 text-base text-ink-muted"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Link href={cta.href} className="btn-primary mt-6 w-full">
              {cta.label}
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
