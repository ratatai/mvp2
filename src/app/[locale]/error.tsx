'use client';

import { useEffect } from 'react';

import { DEFAULT_LOCALE } from '@/i18n/config';
import { getDictionary } from '@/i18n';

/**
 * Error boundary.
 *
 * The visitor never sees the underlying message: Next.js already strips it in
 * production, and this component does not render `error.message` at all.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dict = getDictionary(DEFAULT_LOCALE);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-3xl">{dict.errors.genericTitle}</h1>
      <p className="max-w-md text-sm text-ink-muted">{dict.errors.genericText}</p>
      <button type="button" onClick={reset} className="btn-primary mt-2">
        {dict.common.retry}
      </button>
    </div>
  );
}
