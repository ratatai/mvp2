'use client';

import { useState } from 'react';

import {
  CheckIcon,
  LinkIcon,
  PhoneIcon,
  ShareIcon,
  WhatsAppIcon,
} from '@/components/ui/icons';
import type { PublicSeller } from '@/domain/listing.contract';
import type { Dictionary } from '@/i18n';
import { toTelHref, toWhatsAppHref } from '@/lib/format';

/**
 * Seller contact block.
 *
 * The phone number is revealed on demand — a small friction that keeps casual
 * scrapers from harvesting every number on the site. When the seller has no
 * public number the component shows a neutral sentence, never an error.
 */
export function SellerContact({
  seller,
  dict,
  shareTitle,
}: {
  seller: PublicSeller;
  dict: Dictionary;
  shareTitle: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const phone = seller.phone;
  const whatsapp = phone === null ? null : toWhatsAppHref(phone);

  async function share() {
    const url = window.location.href;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, url });
        return;
      } catch {
        // The visitor dismissed the sheet — fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permissions can be denied; the link is still in the address
      // bar, so there is nothing useful to report here.
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-bold">{dict.listing.seller}</h2>
        <p className="mt-1 text-sm text-ink">
          {seller.display_name ?? dict.listing.sellerNoName}
        </p>
        {seller.city !== null && (
          <p className="text-sm text-ink-muted">{seller.city}</p>
        )}
      </div>

      {phone === null ? (
        <p className="text-sm text-ink-muted">{dict.listing.noPhone}</p>
      ) : !revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="btn-primary w-full"
        >
          <PhoneIcon width={18} height={18} />
          {dict.listing.showPhone}
        </button>
      ) : (
        <div className="space-y-2">
          <a href={toTelHref(phone)} className="btn-primary w-full">
            <PhoneIcon width={18} height={18} />
            {phone}
          </a>
          {whatsapp !== null && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-ghost w-full"
            >
              <WhatsAppIcon width={18} height={18} />
              {dict.listing.whatsapp}
            </a>
          )}
        </div>
      )}

      <button type="button" onClick={share} className="btn-ghost w-full">
        {copied ? (
          <>
            <CheckIcon width={18} height={18} />
            {dict.listing.linkCopied}
          </>
        ) : (
          <>
            <ShareIcon width={18} height={18} />
            {dict.common.share}
          </>
        )}
      </button>

      <p className="flex items-start gap-2 rounded-xl border border-line bg-bg-alt p-3 text-xs leading-relaxed text-ink-muted">
        <LinkIcon width={16} height={16} className="mt-0.5 flex-none text-brand" />
        <span>
          <strong className="block text-ink">{dict.listing.safetyTitle}</strong>
          {dict.listing.safetyText}
        </span>
      </p>
    </div>
  );
}
