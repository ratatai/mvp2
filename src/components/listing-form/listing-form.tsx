'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  createDraftAction,
  publishListingAction,
  updateListingAction,
} from '@/app/actions/listings';
import {
  ImageUploader,
  type UploaderImage,
} from '@/components/listing-form/image-uploader';
import {
  FIELD_GROUPS,
  buildDraftInput,
  findField,
  issuesToFieldErrors,
  specFieldNames,
  type FieldSpec,
  type FormValues,
} from '@/components/listing-form/form-model';
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/icons';
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  type ListingCategory,
} from '@/domain/canonical';
import { parseListingDraft } from '@/domain/listing.validation';
import { interpolate, type Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { LT_CITY_SUGGESTIONS } from '@/lib/site';

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_FIELDS: Readonly<Record<number, readonly string[]>> = {
  2: ['price', 'quantity', 'condition'],
  3: ['title', 'description', 'city', 'area'],
};

export interface ListingFormInitial {
  readonly id: string;
  readonly slug: string;
  readonly category: ListingCategory;
  readonly values: FormValues;
  readonly images: readonly UploaderImage[];
}

export function ListingForm({
  dict,
  locale,
  userId,
  initial,
}: {
  dict: Dictionary;
  locale: Locale;
  userId: string;
  initial?: ListingFormInitial;
}) {
  const router = useRouter();
  const isEdit = initial !== undefined;

  const [step, setStep] = useState<Step>(isEdit ? 1 : 0);
  const [category, setCategory] = useState<ListingCategory | null>(
    initial?.category ?? null
  );
  const [values, setValues] = useState<FormValues>(
    initial?.values ?? { quantity: '4', condition: 'used' }
  );
  const [listingId, setListingId] = useState<string | null>(initial?.id ?? null);
  const [images, setImages] = useState<readonly UploaderImage[]>(
    initial?.images ?? []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalSteps = 6;

  const draftInput = useMemo(
    () => (category === null ? null : buildDraftInput(category, values)),
    [category, values]
  );

  function set(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    // Clear the error as soon as the visitor edits the field it belongs to.
    setErrors((current) => {
      if (current[name] === undefined) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  /** Runs full validation and keeps only the issues belonging to `fields`. */
  function validateFields(fields: readonly string[]): boolean {
    if (draftInput === null) return false;

    const parsed = parseListingDraft(draftInput);
    if (parsed.ok) {
      setErrors({});
      return true;
    }

    const all = issuesToFieldErrors(parsed.issues);
    const scoped: Record<string, string> = {};

    for (const field of fields) {
      const message = all[field];
      if (message !== undefined) scoped[field] = message;
    }

    setErrors(scoped);
    return Object.keys(scoped).length === 0;
  }

  function goNext() {
    setFormError(null);

    if (step === 0) {
      if (category === null) return;
      setStep(1);
      return;
    }

    if (step === 1 && category !== null) {
      if (!validateFields(specFieldNames(category))) return;
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!validateFields(STEP_FIELDS[2] ?? [])) return;
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!validateFields(STEP_FIELDS[3] ?? [])) return;
      void ensureDraftThenPhotos();
      return;
    }

    if (step === 4) {
      setStep(5);
      return;
    }
  }

  /**
   * Photos need an existing listing id, because the Storage path is
   * {userId}/{listingId}/{file}. So the draft is created when the seller
   * leaves the data steps — an abandoned form leaves a private draft, never a
   * half-finished public listing.
   */
  async function ensureDraftThenPhotos() {
    if (listingId !== null) {
      // In edit mode, save the data before touching photos.
      if (isEdit) {
        setBusy(true);
        const result = await updateListingAction(listingId, draftInput);
        setBusy(false);

        if (!result.ok) {
          setErrors(issuesToFieldErrors(result.issues ?? []));
          setFormError(dict.form.errorSubmit);
          return;
        }
      }
      setStep(4);
      return;
    }

    setBusy(true);
    const result = await createDraftAction(draftInput);
    setBusy(false);

    if (!result.ok) {
      setErrors(issuesToFieldErrors(result.issues ?? []));
      setFormError(dict.form.errorSubmit);
      return;
    }

    setListingId(result.data.id);
    setStep(4);
  }

  async function publish() {
    if (listingId === null) return;

    setBusy(true);
    setFormError(null);

    if (isEdit) {
      const updated = await updateListingAction(listingId, draftInput);
      if (!updated.ok) {
        setBusy(false);
        setErrors(issuesToFieldErrors(updated.issues ?? []));
        setFormError(dict.form.errorSubmit);
        return;
      }
    }

    const result = await publishListingAction(listingId);
    setBusy(false);

    if (!result.ok) {
      setFormError(dict.form.errorSubmit);
      return;
    }

    router.push(routes.myListings(locale));
    router.refresh();
  }

  async function saveWithoutPublishing() {
    if (listingId === null) {
      setBusy(true);
      const result = await createDraftAction(draftInput);
      setBusy(false);

      if (!result.ok) {
        setErrors(issuesToFieldErrors(result.issues ?? []));
        setFormError(dict.form.errorSubmit);
        return;
      }
    } else {
      setBusy(true);
      const result = await updateListingAction(listingId, draftInput);
      setBusy(false);

      if (!result.ok) {
        setErrors(issuesToFieldErrors(result.issues ?? []));
        setFormError(dict.form.errorSubmit);
        return;
      }
    }

    router.push(routes.myListings(locale));
    router.refresh();
  }

  /* ---------------------------------------------------------------------- */

  function renderField(field: FieldSpec) {
    const value = values[field.name] ?? '';
    const error = errors[field.name];
    const label = dict.specs[field.labelKey];
    const id = `field-${field.name.replace(/\./g, '-')}`;

    const labelNode = (
      <span className="field-label">
        {label}
        {field.required === true ? (
          <span className="text-brand"> *</span>
        ) : (
          <span className="text-ink-faint"> ({dict.common.optional})</span>
        )}
      </span>
    );

    const describedBy = error === undefined ? undefined : `${id}-error`;

    let control: React.ReactNode;

    switch (field.kind) {
      case 'select':
        control = (
          <select
            id={id}
            className="field"
            value={value}
            aria-invalid={error !== undefined}
            aria-describedby={describedBy}
            onChange={(event) => set(field.name, event.target.value)}
          >
            <option value="">{dict.form.notSelected}</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {optionLabel(dict, field, option)}
              </option>
            ))}
          </select>
        );
        break;

      case 'boolean':
        control = (
          <select
            id={id}
            className="field"
            value={value}
            aria-describedby={describedBy}
            onChange={(event) => set(field.name, event.target.value)}
          >
            <option value="">{dict.form.notSelected}</option>
            <option value="true">{dict.form.yes}</option>
            <option value="false">{dict.form.no}</option>
          </select>
        );
        break;

      case 'checkboxes': {
        const selected = value.split(',').filter((item) => item.length > 0);
        control = (
          <div className="flex flex-wrap gap-3 pt-1">
            {(field.options ?? []).map((option) => (
              <label key={option} className="flex min-h-touch items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-line bg-bg-alt accent-brand"
                  checked={selected.includes(option)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selected, option]
                      : selected.filter((item) => item !== option);
                    set(field.name, next.join(','));
                  }}
                />
                {optionLabel(dict, field, option)}
              </label>
            ))}
          </div>
        );
        break;
      }

      case 'textarea':
        control = (
          <textarea
            id={id}
            className="field min-h-[96px]"
            value={value}
            rows={3}
            aria-invalid={error !== undefined}
            aria-describedby={describedBy}
            onChange={(event) => set(field.name, event.target.value)}
          />
        );
        break;

      case 'number':
        control = (
          <input
            id={id}
            type="number"
            inputMode="decimal"
            className="field"
            value={value}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            placeholder={field.placeholder}
            aria-invalid={error !== undefined}
            aria-describedby={describedBy}
            onChange={(event) => set(field.name, event.target.value)}
          />
        );
        break;

      default:
        control = (
          <input
            id={id}
            type="text"
            className="field"
            value={value}
            placeholder={field.placeholder}
            aria-invalid={error !== undefined}
            aria-describedby={describedBy}
            onChange={(event) => set(field.name, event.target.value)}
          />
        );
    }

    return (
      <div key={field.name}>
        <label htmlFor={id}>{labelNode}</label>
        {control}
        {error !== undefined && (
          <p id={`${id}-error`} className="field-error" role="alert">
            {fieldErrorText(dict, error)}
          </p>
        )}
      </div>
    );
  }

  const stepTitles = [
    dict.form.stepCategory,
    dict.form.stepSpecs,
    dict.form.stepPrice,
    dict.form.stepLocation,
    dict.form.stepPhotos,
    dict.form.stepPreview,
  ];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div>
        <p className="mb-2 text-sm text-ink-muted">
          {interpolate(dict.form.stepOf, { step: step + 1, total: totalSteps })} ·{' '}
          <span className="text-ink">{stepTitles[step]}</span>
        </p>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-bg-alt"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
        >
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {formError !== null && (
        <p role="alert" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">
          {formError}
        </p>
      )}

      {/* Step 0 — category */}
      {step === 0 && (
        <fieldset className="space-y-3">
          <legend className="mb-2 font-display text-lg font-bold">
            {dict.form.chooseCategory}
          </legend>
          <p className="mb-3 text-sm text-ink-muted">
            {dict.form.chooseCategoryHint}
          </p>
          {LISTING_CATEGORIES.map((item) => (
            <label
              key={item}
              className={`card flex min-h-touch cursor-pointer items-center gap-3 p-4 ${
                category === item ? 'border-brand bg-brand/5' : ''
              }`}
            >
              <input
                type="radio"
                name="category"
                value={item}
                checked={category === item}
                onChange={() => setCategory(item)}
                className="h-5 w-5 accent-brand"
              />
              <span className="font-display font-bold">{dict.category[item]}</span>
            </label>
          ))}
        </fieldset>
      )}

      {/* Step 1 — specs */}
      {step === 1 && category !== null && (
        <div className="space-y-6">
          {FIELD_GROUPS[category].map((group, index) => (
            <fieldset key={group.titleKey ?? index} className="space-y-4">
              {group.titleKey !== null && (
                <legend className="eyebrow mb-2">
                  {dict.specs[group.titleKey]}
                </legend>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {group.fields.map((field) => renderField(field))}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {/* Step 2 — price, quantity, condition */}
      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="field-price" className="field-label">
              {dict.form.price} <span className="text-brand">*</span>
            </label>
            <input
              id="field-price"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              className="field"
              value={values['price'] ?? ''}
              aria-invalid={errors['price'] !== undefined}
              onChange={(event) => set('price', event.target.value)}
            />
            <p className="mt-1 text-xs text-ink-faint">{dict.form.priceHint}</p>
            {errors['price'] !== undefined && (
              <p className="field-error" role="alert">
                {dict.form.errorPriceRequired}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="field-quantity" className="field-label">
              {dict.form.quantity} <span className="text-brand">*</span>
            </label>
            <input
              id="field-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              step={1}
              className="field"
              value={values['quantity'] ?? ''}
              aria-invalid={errors['quantity'] !== undefined}
              onChange={(event) => set('quantity', event.target.value)}
            />
            {errors['quantity'] !== undefined && (
              <p className="field-error" role="alert">
                {dict.form.errorQuantity}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="field-condition" className="field-label">
              {dict.form.condition} <span className="text-brand">*</span>
            </label>
            <select
              id="field-condition"
              className="field"
              value={values['condition'] ?? ''}
              onChange={(event) => set('condition', event.target.value)}
            >
              <option value="">{dict.form.notSelected}</option>
              {LISTING_CONDITIONS.map((item) => (
                <option key={item} value={item}>
                  {dict.condition[item]}
                </option>
              ))}
            </select>
            {errors['condition'] !== undefined && (
              <p className="field-error" role="alert">
                {dict.form.errorRequired}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 3 — title, description, location */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="field-title" className="field-label">
              {dict.form.title} <span className="text-brand">*</span>
            </label>
            <input
              id="field-title"
              type="text"
              className="field"
              placeholder={dict.form.titlePlaceholder}
              value={values['title'] ?? ''}
              aria-invalid={errors['title'] !== undefined}
              onChange={(event) => set('title', event.target.value)}
            />
            <p className="mt-1 text-xs text-ink-faint">{dict.form.titleHint}</p>
            {errors['title'] !== undefined && (
              <p className="field-error" role="alert">
                {dict.form.errorTitleShort}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="field-city" className="field-label">
                {dict.form.city} <span className="text-brand">*</span>
              </label>
              <input
                id="field-city"
                type="text"
                list="city-suggestions"
                className="field"
                placeholder={dict.form.cityPlaceholder}
                value={values['city'] ?? ''}
                aria-invalid={errors['city'] !== undefined}
                onChange={(event) => set('city', event.target.value)}
              />
              <datalist id="city-suggestions">
                {LT_CITY_SUGGESTIONS.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
              {errors['city'] !== undefined && (
                <p className="field-error" role="alert">
                  {dict.form.errorRequired}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="field-area" className="field-label">
                {dict.form.area}{' '}
                <span className="text-ink-faint">({dict.common.optional})</span>
              </label>
              <input
                id="field-area"
                type="text"
                className="field"
                placeholder={dict.form.areaPlaceholder}
                value={values['area'] ?? ''}
                onChange={(event) => set('area', event.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="field-description" className="field-label">
              {dict.form.description} <span className="text-brand">*</span>
            </label>
            <textarea
              id="field-description"
              className="field min-h-[140px]"
              rows={6}
              placeholder={dict.form.descriptionPlaceholder}
              value={values['description'] ?? ''}
              aria-invalid={errors['description'] !== undefined}
              onChange={(event) => set('description', event.target.value)}
            />
            {errors['description'] !== undefined && (
              <p className="field-error" role="alert">
                {dict.form.errorDescriptionShort}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 4 — photos */}
      {step === 4 && listingId !== null && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-bold">{dict.form.photos}</h2>
          <ImageUploader
            listingId={listingId}
            userId={userId}
            initialImages={images}
            dict={dict}
            onChange={setImages}
          />
        </div>
      )}

      {/* Step 5 — preview */}
      {step === 5 && category !== null && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold">
              {dict.form.previewTitle}
            </h2>
            <p className="text-sm text-ink-muted">{dict.form.previewHint}</p>
          </div>

          <article className="card overflow-hidden">
            {images.length > 0 && images[0] !== undefined && (
              <div className="relative aspect-[4/3] w-full bg-bg-alt">
                <Image
                  src={images[0].public_url}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                />
              </div>
            )}

            <div className="space-y-4 p-5">
              <p className="chip">{dict.category[category]}</p>
              <h3 className="text-xl">{values['title']}</h3>
              <p className="font-display text-2xl font-extrabold">
                {formatPrice(Number(values['price'] ?? 0), locale)}
              </p>

              <dl className="grid gap-x-6 sm:grid-cols-2">
                {previewRows(category, values, dict).map((item) => (
                  <div
                    key={item.label}
                    className="flex justify-between gap-4 border-b border-line py-2 text-sm"
                  >
                    <dt className="text-ink-muted">{item.label}</dt>
                    <dd className="text-right font-medium">{item.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="whitespace-pre-line text-sm text-ink-muted">
                {values['description']}
              </p>
            </div>
          </article>
        </div>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        {step > (isEdit ? 1 : 0) && (
          <button
            type="button"
            onClick={() => setStep((current) => (current - 1) as Step)}
            className="btn-ghost"
            disabled={busy}
          >
            <ArrowLeftIcon width={18} height={18} />
            {dict.common.back}
          </button>
        )}

        {step < 5 ? (
          <button
            type="button"
            onClick={goNext}
            className="btn-primary flex-1 sm:flex-none"
            disabled={busy || (step === 0 && category === null)}
          >
            {busy ? dict.form.saving : dict.common.next}
            <ArrowRightIcon width={18} height={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void publish()}
            className="btn-primary flex-1 sm:flex-none"
            disabled={busy}
          >
            {busy ? dict.form.publishing : dict.form.publish}
          </button>
        )}

        {step >= 1 && (
          <button
            type="button"
            onClick={() => void saveWithoutPublishing()}
            className="btn-quiet"
            disabled={busy}
          >
            {isEdit ? dict.form.saveChanges : dict.form.saveDraft}
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function optionLabel(dict: Dictionary, field: FieldSpec, option: string): string {
  switch (field.optionDict) {
    case 'season':
      return dict.season[option as keyof Dictionary['season']] ?? option;
    case 'material':
      return dict.material[option as keyof Dictionary['material']] ?? option;
    case 'origin':
      return dict.origin[option as keyof Dictionary['origin']] ?? option;
    case 'repairs':
      return dict.repairs[option as keyof Dictionary['repairs']] ?? option;
    case 'saleUnit':
      return dict.saleUnit[option as keyof Dictionary['saleUnit']] ?? option;
    case 'condition':
      return dict.condition[option as keyof Dictionary['condition']] ?? option;
    default:
      return option;
  }
}

/** Maps a validation code to a translated sentence. */
function fieldErrorText(dict: Dictionary, code: string): string {
  if (code.includes('invalid_pcd')) return dict.form.errorPcd;
  if (code.includes('bolt_count_pcd_mismatch')) return dict.form.errorPcdBoltCount;
  if (code.includes('wheel_diameter_mismatch')) return dict.form.errorWheelDiameter;
  if (code.includes('Required') || code.includes('required')) {
    return dict.form.errorRequired;
  }
  if (code.includes('Expected number')) return dict.form.errorNumber;
  return dict.form.errorRequired;
}

function previewRows(
  category: ListingCategory,
  values: FormValues,
  dict: Dictionary
): readonly { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  const condition = values['condition'];
  if (condition === 'new' || condition === 'used') {
    rows.push({ label: dict.specs.condition, value: dict.condition[condition] });
  }

  const quantity = values['quantity'];
  if (quantity !== undefined && quantity.length > 0) {
    rows.push({
      label: dict.listing.quantity,
      value: `${quantity} ${dict.common.pieces}`,
    });
  }

  const city = values['city'];
  if (city !== undefined && city.length > 0) {
    rows.push({ label: dict.listing.city, value: city });
  }

  for (const name of specFieldNames(category)) {
    const raw = values[name]?.trim() ?? '';
    if (raw.length === 0) continue;

    const field = findField(category, name);
    if (field === undefined) continue;

    let display = raw;

    if (field.kind === 'boolean') {
      display = raw === 'true' ? dict.form.yes : dict.form.no;
    } else if (field.kind === 'select') {
      display = optionLabel(dict, field, raw);
    } else if (field.kind === 'checkboxes') {
      display = raw
        .split(',')
        .filter((item) => item.length > 0)
        .map((item) => optionLabel(dict, field, item))
        .join(', ');
    }

    rows.push({ label: dict.specs[field.labelKey], value: display });
  }

  return rows;
}
