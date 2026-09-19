'use client';

import Image from 'next/image';
import { useCallback, useRef, useState, useTransition } from 'react';

import {
  registerImagesAction,
  removeImageAction,
  reorderImagesAction,
  setPrimaryImageAction,
} from '@/app/actions/listings';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ImageIcon,
  TrashIcon,
} from '@/components/ui/icons';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGES_PER_LISTING,
  MAX_IMAGE_BYTES,
} from '@/domain/listing.contract';
import type { Dictionary } from '@/i18n';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const BUCKET = 'listing-images';

export interface UploaderImage {
  readonly id: string;
  readonly public_url: string;
  readonly position: number;
  readonly is_primary: boolean;
}

function extensionFor(type: string): string {
  switch (type) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

/** Collision-proof object name; the bucket is written with upsert disabled. */
function generateFileName(type: string): string {
  const random =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${random}.${extensionFor(type)}`;
}

export function ImageUploader({
  listingId,
  userId,
  initialImages,
  dict,
  onChange,
}: {
  listingId: string;
  userId: string;
  initialImages: readonly UploaderImage[];
  dict: Dictionary;
  onChange?: (images: readonly UploaderImage[]) => void;
}) {
  const [images, setImages] = useState<readonly UploaderImage[]>(initialImages);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const publish = useCallback(
    (next: readonly UploaderImage[]) => {
      setImages(next);
      onChange?.(next);
    },
    [onChange]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (files === null || files.length === 0) return;
      // Guard against a second click while the first upload is in flight.
      if (uploading) return;

      setError(null);

      const selected = Array.from(files);

      if (images.length + selected.length > MAX_IMAGES_PER_LISTING) {
        setError(dict.form.photosTooMany);
        return;
      }

      for (const file of selected) {
        if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
          setError(dict.form.photosWrongType);
          return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          setError(dict.form.photosTooLarge);
          return;
        }
      }

      setUploading(true);

      const supabase = createSupabaseBrowserClient();
      const uploaded: { storagePath: string; publicUrl: string }[] = [];

      try {
        for (const file of selected) {
          const path = `${userId}/${listingId}/${generateFileName(file.type)}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, {
              contentType: file.type,
              // Never silently overwrite an existing object.
              upsert: false,
            });

          if (uploadError !== null) {
            // Roll back whatever this batch already uploaded, so no object is
            // left in the bucket without a matching metadata row.
            if (uploaded.length > 0) {
              await supabase.storage
                .from(BUCKET)
                .remove(uploaded.map((item) => item.storagePath));
            }
            setError(dict.form.photosUploadFailed);
            setUploading(false);
            return;
          }

          const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
          uploaded.push({ storagePath: path, publicUrl: data.publicUrl });
        }

        const result = await registerImagesAction(listingId, uploaded);

        if (!result.ok) {
          setError(dict.form.photosUploadFailed);
          setUploading(false);
          return;
        }

        publish([...images, ...result.data]);
      } catch {
        setError(dict.form.photosUploadFailed);
      } finally {
        setUploading(false);
        if (inputRef.current !== null) inputRef.current.value = '';
      }
    },
    [dict, images, listingId, publish, uploading, userId]
  );

  function remove(imageId: string) {
    startTransition(async () => {
      const result = await removeImageAction(listingId, imageId);
      if (!result.ok) {
        setError(dict.dashboard.actionFailed);
        return;
      }

      const next = images.filter((image) => image.id !== imageId);

      // Mirror the server-side promotion of the next photo.
      if (
        next.length > 0 &&
        !next.some((image) => image.is_primary) &&
        next[0] !== undefined
      ) {
        publish(
          next.map((image, index) =>
            index === 0 ? { ...image, is_primary: true } : image
          )
        );
        return;
      }

      publish(next);
    });
  }

  function makePrimary(imageId: string) {
    startTransition(async () => {
      const result = await setPrimaryImageAction(listingId, imageId);
      if (!result.ok) {
        setError(dict.dashboard.actionFailed);
        return;
      }
      publish(
        images.map((image) => ({ ...image, is_primary: image.id === imageId }))
      );
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;

    const next = [...images];
    const current = next[index];
    const other = next[target];
    if (current === undefined || other === undefined) return;

    next[index] = other;
    next[target] = current;

    // The photo that ends up first becomes the primary one, matching what the
    // server does and what buyers will actually see first.
    const reindexed = next.map((image, position) => ({
      ...image,
      position,
      is_primary: position === 0,
    }));
    publish(reindexed);

    startTransition(async () => {
      const result = await reorderImagesAction(
        listingId,
        reindexed.map((image) => image.id)
      );
      if (!result.ok) setError(dict.dashboard.actionFailed);
    });
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={`rounded-brand border-2 border-dashed p-6 text-center transition ${
          dragOver ? 'border-brand bg-brand/5' : 'border-line bg-bg-alt'
        }`}
      >
        <ImageIcon width={32} height={32} className="mx-auto mb-3 text-ink-faint" />
        <p className="mb-1 text-sm text-ink-muted">{dict.form.photosDrop}</p>
        <p className="mb-4 text-xs text-ink-faint">{dict.form.photosHint}</p>

        <input
          ref={inputRef}
          id="listing-photos"
          type="file"
          accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
          multiple
          className="sr-only"
          onChange={(event) => void handleFiles(event.target.files)}
          disabled={uploading || images.length >= MAX_IMAGES_PER_LISTING}
        />
        <label
          htmlFor="listing-photos"
          className={`btn-ghost cursor-pointer ${
            uploading || images.length >= MAX_IMAGES_PER_LISTING
              ? 'pointer-events-none opacity-60'
              : ''
          }`}
        >
          {uploading ? dict.form.photosUploading : dict.form.photosAdd}
        </label>

        <p className="mt-3 text-xs text-ink-faint">
          {images.length} / {MAX_IMAGES_PER_LISTING}
        </p>
      </div>

      {error !== null && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}

      {images.length === 0 ? (
        <p className="text-sm text-ink-muted">{dict.form.photosEmpty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="card overflow-hidden">
              <div className="relative aspect-[4/3] bg-bg-alt">
                <Image
                  src={image.public_url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, 200px"
                  className="object-cover"
                />
                {image.is_primary && (
                  <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-white">
                    {dict.form.photosPrimary}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-1 p-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={dict.form.photosMoveLeft}
                    className="btn-quiet min-h-touch min-w-touch px-2 disabled:opacity-30"
                  >
                    <ArrowLeftIcon width={16} height={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1}
                    aria-label={dict.form.photosMoveRight}
                    className="btn-quiet min-h-touch min-w-touch px-2 disabled:opacity-30"
                  >
                    <ArrowRightIcon width={16} height={16} />
                  </button>
                </div>

                <div className="flex gap-1">
                  {!image.is_primary && (
                    <button
                      type="button"
                      onClick={() => makePrimary(image.id)}
                      aria-label={dict.form.photosSetPrimary}
                      title={dict.form.photosSetPrimary}
                      className="btn-quiet min-h-touch min-w-touch px-2"
                    >
                      <CheckIcon width={16} height={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(image.id)}
                    aria-label={dict.form.photosRemove}
                    className="btn-quiet min-h-touch min-w-touch px-2 text-brand"
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
