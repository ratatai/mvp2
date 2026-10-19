'use client';

import { usePathname } from 'next/navigation';
import { useEffect, type CSSProperties } from 'react';

import { localeFromPathname } from '@/i18n/config';
import { getDictionary } from '@/i18n';

/**
 * Last-resort error boundary.
 *
 * `[locale]/error.tsx` cannot catch errors thrown by `[locale]/layout.tsx`
 * itself, which owns `<html>`/`<body>`. Those errors reach this file, which
 * replaces the whole document. So it renders its own `<html lang>`/`<body>`,
 * uses inline system-font styles and does not depend on the site shell,
 * global CSS or next/font.
 *
 * The language comes from the first path segment, falling back to Lithuanian.
 * The visitor never sees the underlying message or digest.
 */

const styles = {
  body: {
    margin: 0,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: '#111827',
    background: '#ffffff',
  },
  main: {
    maxWidth: '28rem',
    padding: '2rem 1rem',
    textAlign: 'center',
  },
  title: { fontSize: '1.75rem', margin: '0 0 1rem' },
  text: { fontSize: '0.875rem', color: '#4b5563', margin: '0 0 1.5rem' },
  actions: { display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' },
  button: {
    font: 'inherit',
    padding: '0.5rem 1rem',
    border: 0,
    borderRadius: '0.375rem',
    background: '#111827',
    color: '#ffffff',
    cursor: 'pointer',
  },
  link: { padding: '0.5rem 1rem', color: '#111827' },
} satisfies Record<string, CSSProperties>;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = localeFromPathname(usePathname());
  const dict = getDictionary(locale);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error(error);
    }
  }, [error]);

  return (
    <html lang={locale}>
      <body style={styles.body}>
        <main style={styles.main}>
          <h1 style={styles.title}>{dict.errors.genericTitle}</h1>
          <p style={styles.text}>{dict.errors.genericText}</p>
          <div style={styles.actions}>
            <button type="button" onClick={reset} style={styles.button}>
              {dict.common.retry}
            </button>
            {/* A plain anchor forces a full reload, rebuilding the failed shell. */}
            <a href={`/${locale}`} style={styles.link}>
              {dict.errors.goHome}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
