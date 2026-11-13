'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CloseIcon, MenuIcon } from '@/components/ui/icons';

export interface NavLink {
  readonly href: string;
  readonly label: string;
}

/** Tailwind's `lg` screen, where the drawer and its trigger are hidden. */
const DESKTOP_QUERY = '(min-width: 1024px)';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mobile navigation drawer.
 *
 * Closes on Escape, on the close button, on navigation and when the viewport
 * reaches the desktop breakpoint. While open it keeps Tab and Shift+Tab inside
 * the drawer and locks body scrolling so the drawer itself is what scrolls.
 * Dismissing it with Escape or the close button returns focus to the trigger;
 * closing on navigation or resize does not, so focus is never pulled back to
 * the header of a new page or to a trigger that is hidden on desktop.
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef(false);

  /** Closes the drawer and returns focus to the trigger once it is gone. */
  const dismiss = useCallback(() => {
    restoreFocusRef.current = true;
    setOpen(false);
  }, []);

  useEffect(() => {
    restoreFocusRef.current = false;
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    triggerRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const desktop = window.matchMedia(DESKTOP_QUERY);

    function onBreakpointChange() {
      if (!desktop.matches) return;
      restoreFocusRef.current = false;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        dismiss();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (dialog === null) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;

      const active = document.activeElement;
      const inside = active !== null && dialog.contains(active);
      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onBreakpointChange);
    // The viewport may already be desktop-sized by the time this runs.
    onBreakpointChange();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onBreakpointChange);
    };
  }, [open, dismiss]);

  return (
    <>
      <button
        ref={triggerRef}
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
          ref={dialogRef}
          className="fixed inset-0 z-[70] flex flex-col bg-bg lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={openLabel}
        >
          <div className="flex h-[68px] flex-none items-center justify-end px-4">
            <button
              type="button"
              onClick={dismiss}
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
