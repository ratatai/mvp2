# RATATAI Marketplace

Open source classifieds board for **tyres, rims and complete wheels** in Lithuania.

Buyers browse and filter listings without registering and contact sellers directly.
Sellers register, publish listings with photos, and manage them from their own
dashboard. There is no payment processing, no commission and no chat — RATATAI is
a noticeboard, not a shop.

Licensed under the [MIT License](./LICENSE).

---

## Stack

Everything is open source. No paid CMS, no paid search service, no AI services.

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email + password) |
| Files | Supabase Storage |
| Validation | Zod |
| Tests | Vitest (unit, integration) + Playwright (E2E) |

Runtime dependencies: `next`, `react`, `react-dom`, `@supabase/supabase-js`,
`@supabase/ssr`, `zod`. That is the whole list — no UI kit, no state manager,
no ORM, no analytics SDK.

---

## Quick start

```bash
# 1. Install (exact versions from package-lock.json)
npm ci

# 2. Configure
cp .env.example .env.local
#    then fill in the two Supabase values (see "Environment" below)

# 3. Apply the database schema — see "Database setup"

# 4. Run
npm run dev          # http://localhost:3000
```

---

## Environment

Only public variables exist. **Never** put a `service_role` or secret key in any
`NEXT_PUBLIC_*` variable — those are shipped to the browser. Access control is
enforced by Row Level Security in the database, not by hiding a key.

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API Keys → **anon / publishable** |
| `NEXT_PUBLIC_SITE_URL` | Public origin of the deployment, no trailing slash |

`.env.local` is git-ignored and must never be committed.

---

## Database setup

Identify the starting point of the target database **before** running any SQL.
An empty marketplace is not the same as a disposable database: a project with
no listings can still hold real Auth users and profiles.

| Starting point | Recognised by | Supported path |
|---|---|---|
| Fresh database | no `public.profiles`, `public.listings`, `public.listing_images` | `001` → `002` |
| `seller_id` legacy (old lean MVP) | `public.listings.seller_id` exists | `000` → `001` → `002` |
| August `user_id` legacy | `listings.user_id`, `profiles.full_name`, `profiles.username`, `profiles.is_dealer`, and **no** `profiles.phone_is_public` | reconcile migration only, via [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md) |

Read-only check:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('listings','seller_id'), ('listings','user_id'),
    ('profiles','full_name'), ('profiles','username'),
    ('profiles','is_dealer'), ('profiles','phone_is_public'))
order by 1, 2;
```

### A fresh database

Hosted project: run in Supabase Dashboard → **SQL Editor** → New query, in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_security_hardening.sql`

Local stack: `supabase db reset` applies every file in filename order. `000`
finds no `seller_id` and does nothing, `001` and `002` create the canonical
schema, and `20260929144644_reconcile_august_schema_to_canonical.sql` detects
the canonical schema, verifies it and changes nothing. (This canonical no-op
path has not yet been executed from this repository; see the runbook.)

### A project that already ran the old lean-MVP (`seller_id`) migrations

Run the compatibility step **first**. It renames the old tables to `legacy_*` so
that every existing row is preserved and readable. It performs no `DROP TABLE`
and no `DELETE`.

1. `supabase/migrations/000_legacy_compatibility.sql`
2. `supabase/migrations/001_initial_schema.sql`
3. `supabase/migrations/002_security_hardening.sql`

Afterwards you can inspect the archived rows with `select * from public.legacy_listings;`
and drop those tables yourself once you no longer need them.

### The August `user_id` legacy schema (the hosted project)

**Do not run `000`, `001` or `002`, and do not run `supabase db push`, against it.**
`000` does not detect this schema (it looks for `seller_id`). `001` would replace
`public.handle_new_user()` and add a second signup trigger before failing at the
`listing_sellers` view (`moderation_status` does not exist).

The only supported path is
`supabase/migrations/20260929144644_reconcile_august_schema_to_canonical.sql`,
applied exactly as described in [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md),
after a written owner decision. It runs as one atomic block and aborts on any
unrecognised structure or failed precondition.

- It requires an empty marketplace: no listings, listing images or
  `listing-images` objects.
- It keeps **every profile row** (same `id`) and **every Auth user** (verified by
  digest).
- It does **not** keep every profile field:
  - `display_name = coalesce(nullif(btrim(full_name),''), nullif(btrim(username),''))`,
    so `username` is lost whenever `full_name` is non-blank.
  - `is_dealer` and any other unmapped legacy column are dropped.
  - `preferred_language` is set to `'lt'`.
  - `phone_is_public` is set to `true` for every profile.
- The legacy path has only been executed on a restored clone (reported, not
  re-run here). It cannot be reproduced from this repository, because the source
  August schema backup is not tracked.

### Optional demo data

`supabase/seed.sql` inserts three demo listings for local or staging use. It
requires at least one registered user and refuses to run if any listing already
exists. **Do not run it against production** — the quality gate requires that no
demo listing is ever publicly visible.

Remove it later with `delete from public.listings where slug like 'demo-%';`

### Auth settings

In Supabase Dashboard → Authentication → URL Configuration, add your site URL and
the redirect URL `<your-site>/auth/callback`. For local development that is
`http://localhost:3000/auth/callback`.

---

## Data contract

Canonical values are the only representation ever written to the database. They
are never translated, and UI strings are never stored.

| Field | Canonical values |
|---|---|
| `category` | `padangos`, `ratlankiai`, `komplektiniai_ratai` |
| `condition` | `new`, `used` |
| `status` | `draft`, `active`, `sold`, `archived` |
| `moderation_status` | `pending`, `approved`, `rejected` |
| `season` (in specs) | `summer`, `winter`, `all_season` |
| `material` (in specs) | `alloy`, `steel`, `forged` |

Legacy strings are converted through explicit typed mappers in
`src/domain/canonical.ts` — `vasara → summer`, `naudotas → used`,
`ratai → komplektiniai_ratai`, `centerBore → cb`, `offset → et`. A mapper returns
`null` for anything it does not recognise; it never guesses.

Technical data lives in `listings.specs` (JSONB), validated per category at the
application boundary by strict Zod schemas in `src/domain/listing.validation.ts`.
Tyre specs cannot be accepted as rim specs, and a mixed or truncated object is
rejected rather than repaired.

Sizes are always stored as separate numbers. `205/55 R16` is derived from
`width`, `aspect_ratio` and `diameter` for display — never stored as the source
of truth. Width is **not** capped at 305, so 355 and 375 section tyres are
listable.

A missing optional value stays missing. Nothing in the codebase substitutes the
current year, `0 mm`, `4 pieces`, a brand or a city for data the seller did not
enter.

---

## Project layout

```
src/
  app/                    routes (App Router), server actions, sitemap, robots
    [locale]/             every page lives under /lt, /ru or /en
    auth/callback/        Supabase email confirmation and recovery
    actions/              server actions (auth, listings, profile)
  domain/                 the contract: canonical values, types, validation,
                          mappers, filter serialization — no framework imports
  lib/
    supabase/             browser and server clients, database row types
    repositories/         all data access; raw errors never leave this layer
    routes.ts             URL helpers
    format.ts             locale-aware price, date and number formatting
    search.ts             safe query escaping, tyre-size parsing
  components/             UI, grouped by area
  i18n/                   dictionaries (lt, ru, en) and locale helpers
  content/legal.ts        Privacy Policy and Terms, all three languages
supabase/migrations/      SQL schema, RLS, Storage policies
tests/                    unit, integration, e2e
```

UI components never contain Supabase queries. The flow is always
**UI → server action → repository → Supabase**.

---

## Languages

Lithuanian is the default; Russian and English are fully supported. Every page
lives under a locale prefix, so a URL is always unambiguous and shareable. The
chosen language is remembered in a cookie.

`src/i18n/dictionaries/lt.json` is the source of truth for the dictionary shape:
`ru.json` and `en.json` are typed as `Dictionary`, so the build fails if a key is
missing or added in only one of them.

Prices are formatted per locale and always in EUR.

---

## Security model

| Role | Can |
|---|---|
| `anon` | Read `active` + `approved` listings and their images; read the public seller view. No writes anywhere. |
| `authenticated` | Everything above, plus full owner-scoped CRUD on their own listings, images and profile. |
| `service_role` | Not used by this application and never shipped to the browser. |

- Every table has RLS enabled with explicit `anon` / `authenticated` policies.
- `WITH CHECK (auth.uid() = user_id)` makes it impossible to reassign a listing
  to another user.
- Public seller data comes from the `listing_sellers` view, which exposes only
  display name, city, and the phone number *when the seller made it public*. The
  email address and the auth UUID are never selected.
- Storage writes are constrained to `{userId}/{listingId}/…` for listings the
  user owns, with `upsert: false`, so overwriting another user's file is
  impossible.
- All database functions pin `search_path`.
- Repositories translate database errors into a small set of codes; a raw
  PostgREST message can never reach a page.

---

## Scripts

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # serve the production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test        # unit + integration (Vitest)
npm run test:e2e    # Playwright (local Supabase only, see E2E_SAFETY.md)
npm run verify      # lint + typecheck + test + build
```

E2E runs only against a local Supabase stack and builds and starts its own
server — never run it with the production `.env.local`. Read
[E2E_SAFETY.md](E2E_SAFETY.md) before running `npm run test:e2e`.

---

## Deployment

Any host that runs Next.js works. Set the three environment variables, run
`npm run build`, then `npm run start`. The variables must be present **at build
time**: `NEXT_PUBLIC_*` values are inlined into the browser bundle. `npm run build`
completes without them (per-user pages are rendered on demand), but such a build
is only a compile check and cannot be deployed.

Deploy to a **preview URL first**. Do not point production DNS at this
application until you have verified the full flow against your live Supabase
project.

---

## Contributing

Issues and pull requests are welcome. Please keep the dependency list short,
keep Supabase queries inside `src/lib/repositories/`, and add a test for any
change to the data contract.
