'use client';

import Image from 'next/image';
import { useState } from 'react';

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ImageIcon,
} from '@/components/ui/icons';
import type { ListingImage } from '@/domain/listing.contract';
import { interpolate } from '@/i18n';
import type { Dictionary } from '@/i18n';

/**
 * Listing gallery.
 *
 * Images arrive already sorted (primary first, then by position). With no
 * photos at all the component shows a localized empty state rather than a
 * broken image or a stock picture.
 */
export function Gallery({
  images,
  title,
  dict,
}: {
  images: readonly ListingImage[];
  title: string;
  dict: Dictionary;
}) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div
        className="card flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 text-ink-faint"
        role="img"
        aria-label={dict.listing.noImages}
      >
        <ImageIcon width={40} height={40} />
        <span className="text-sm">{dict.listing.noImages}</span>
      </div>
    );
  }

  const safeIndex = Math.min(index, images.length - 1);
  const current = images[safeIndex];
  if (current === undefined) return null;

  const go = (delta: number) => {
    setIndex((value) => {
      const next = (value + delta + images.length) % images.length;
      return next;
    });
  };

  return (
    <section aria-label={dict.listing.gallery} className="space-y-3">
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-brand border border-line bg-bg-alt"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            go(-1);
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            go(1);
          }
        }}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
      >
        <Image
          src={current.public_url}
          alt={interpolate(dict.listing.imageAlt, {
            title,
            index: safeIndex + 1,
          })}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          priority
          className="object-contain"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={dict.listing.previousImage}
              className="absolute left-2 top-1/2 flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bg/80 text-ink backdrop-blur transition hover:bg-bg"
            >
              <ArrowLeftIcon />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={dict.listing.nextImage}
              className="absolute right-2 top-1/2 flex min-h-touch min-w-touch -translate-y-1/2 items-center justify-center rounded-full border border-line bg-bg/80 text-ink backdrop-blur transition hover:bg-bg"
            >
              <ArrowRightIcon />
            </button>
            <p className="absolute bottom-2 right-2 rounded-full bg-bg/80 px-2.5 py-1 text-xs text-ink-muted backdrop-blur">
              {safeIndex + 1} / {images.length}
            </p>
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, position) => (
            <li key={image.id} className="flex-none">
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={interpolate(dict.listing.imageAlt, {
                  title,
                  index: position + 1,
                })}
                aria-current={position === safeIndex}
                className={`relative h-16 w-20 overflow-hidden rounded-lg border transition ${
                  position === safeIndex
                    ? 'border-brand'
                    : 'border-line hover:border-line-strong'
                }`}
              >
                <Image
                  src={image.public_url}
                  alt=""
                  fill
                  sizes="80px"
                  loading="lazy"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
