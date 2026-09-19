'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import {
  changeStatusAction,
  deleteListingAction,
} from '@/app/actions/listings';
import type { ListingStatus } from '@/domain/canonical';
import type { Dictionary } from '@/i18n';

/**
 * Owner actions for one listing. Every destructive action asks first, and the
 * confirmation dialog can be dismissed with Escape.
 */
export function ListingActions({
  listingId,
  status,
  dict,
}: {
  listingId: string;
  status: ListingStatus;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirming) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setConfirming(false);
    }

    cancelRef.current?.focus();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirming]);

  function changeStatus(next: ListingStatus) {
    setError(null);
    startTransition(async () => {
      const result = await changeStatusAction(listingId, next);
      if (!result.ok) {
        setError(dict.dashboard.actionFailed);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteListingAction(listingId);
      if (!result.ok) {
        setError(dict.dashboard.actionFailed);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === 'active' && (
          <button
            type="button"
            onClick={() => changeStatus('sold')}
            disabled={pending}
            className="btn-ghost px-3 py-2 text-sm"
          >
            {dict.dashboard.markSold}
          </button>
        )}

        {(status === 'sold' || status === 'archived' || status === 'draft') && (
          <button
            type="button"
            onClick={() => changeStatus('active')}
            disabled={pending}
            className="btn-ghost px-3 py-2 text-sm"
          >
            {dict.dashboard.reactivate}
          </button>
        )}

        {status !== 'archived' && (
          <button
            type="button"
            onClick={() => changeStatus('archived')}
            disabled={pending}
            className="btn-ghost px-3 py-2 text-sm"
          >
            {dict.dashboard.archive}
          </button>
        )}

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="btn-quiet px-3 py-2 text-sm text-brand"
        >
          {dict.common.delete}
        </button>
      </div>

      {error !== null && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-${listingId}`}
        >
          <div className="card w-full max-w-sm p-6">
            <h2 id={`confirm-${listingId}`} className="text-lg">
              {dict.dashboard.deleteConfirmTitle}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {dict.dashboard.deleteConfirmText}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setConfirming(false)}
                className="btn-ghost flex-1"
                disabled={pending}
              >
                {dict.common.cancel}
              </button>
              <button
                type="button"
                onClick={remove}
                className="btn-primary flex-1"
                disabled={pending}
              >
                {dict.dashboard.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
