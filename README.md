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
# 1. Install
npm install

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

Run the SQL files in Supabase Dashboard → **SQL Editor** → New query, in order.

### A fresh Supabase project

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_security_hardening.sql`

### A project that already ran the old lean-MVP migrations

Run the compatibility step **first**. It renames the old tables to `legacy_*` so
that every existing row is preserved and readable. It performs no `DROP TABLE`
and no `DELETE`.

1. `supabase/migrations/000_legacy_compatibility.sql`
2. `supabase/migrations/001_initial_schema.sql`
3. `supabase/migrations/002_security_hardening.sql`

Afterwards you can inspect the archived rows with `select * from public.legacy_listings;`
and drop those tables yourself once you no longer need them.

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
npm run test:e2e    # Playwright (needs a running app)
npm run verify      # lint + typecheck + test + build
```

For E2E: `npm run test:e2e:install` once to fetch the browser, then `npm run build`,
`npm run start`, and `npm run test:e2e` in another terminal. The seller-lifecycle
spec only runs when `E2E_EMAIL` and `E2E_PASSWORD` are set to a throwaway test
account.

---

## Deployment

Any host that runs Next.js works. Set the three environment variables, run
`npm run build`, then `npm run start`.

Deploy to a **preview URL first**. Do not point production DNS at this
application until you have verified the full flow against your live Supabase
project.

---

## Contributing

Issues and pull requests are welcome. Please keep the dependency list short,
keep Supabase queries inside `src/lib/repositories/`, and add a test for any
change to the data contract.
