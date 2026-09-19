'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  IDLE_PROFILE_STATE,
  updateProfileAction,
} from '@/app/actions/profile';
import type { OwnProfile } from '@/lib/repositories/profiles';
import { LOCALES, LOCALE_LABELS } from '@/i18n/config';
import type { Dictionary } from '@/i18n';
import { LT_CITY_SUGGESTIONS } from '@/lib/site';

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ProfileForm({
  profile,
  dict,
}: {
  profile: OwnProfile;
  dict: Dictionary;
}) {
  const [state, action] = useActionState(updateProfileAction, IDLE_PROFILE_STATE);

  return (
    <form action={action} className="space-y-5">
      {state.status === 'saved' && (
        <p role="status" className="rounded-xl border border-success/40 bg-success/10 p-3 text-sm">
          {dict.profile.saved}
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">
          {dict.profile.saveFailed}
        </p>
      )}

      <label className="block">
        <span className="field-label">{dict.profile.displayName}</span>
        <input
          type="text"
          name="displayName"
          className="field"
          autoComplete="name"
          defaultValue={profile.displayName ?? ''}
        />
      </label>

      <label className="block">
        <span className="field-label">{dict.profile.phone}</span>
        <input
          type="tel"
          name="phone"
          className="field"
          autoComplete="tel"
          placeholder="+370 600 00000"
          defaultValue={profile.phone ?? ''}
        />
        <span className="mt-1 block text-xs text-ink-faint">
          {dict.profile.phoneHint}
        </span>
      </label>

      <label className="flex min-h-touch items-center gap-3">
        <input
          type="checkbox"
          name="phoneIsPublic"
          className="h-5 w-5 rounded border-line bg-bg-alt accent-brand"
          defaultChecked={profile.phoneIsPublic}
        />
        <span className="text-sm">{dict.profile.phonePublic}</span>
      </label>

      <label className="block">
        <span className="field-label">{dict.profile.city}</span>
        <input
          type="text"
          name="city"
          list="profile-city-suggestions"
          className="field"
          defaultValue={profile.city ?? ''}
        />
        <datalist id="profile-city-suggestions">
          {LT_CITY_SUGGESTIONS.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
      </label>

      <label className="block">
        <span className="field-label">{dict.profile.language}</span>
        <select
          name="preferredLanguage"
          className="field"
          defaultValue={profile.preferredLanguage}
        >
          {LOCALES.map((item) => (
            <option key={item} value={item}>
              {LOCALE_LABELS[item]}
            </option>
          ))}
        </select>
      </label>

      <SaveButton label={dict.profile.save} pendingLabel={dict.form.saving} />
    </form>
  );
}
