# Implementation log

Chronological record of how this repository was built, what was reused from the
previous RATATAI work, and what was deliberately left out.

---

## Phase 0 — Audit

**Old projects inspected (all left untouched on disk):**

| Folder | What it is |
|---|---|
| `Downloads/ratatai-mvp-main (3)` | Most complete lean MVP: Next.js 14, 3 migrations, login and create-listing |
| `Downloads/ratatai-mvp-main`, `(1)`, `(2)` | Earlier copies of the same project |
| `Downloads/ratatai-foundation` | Foundation-only skeleton, no migrations |
| `Downloads/ratatai-site` | The live static site — source of the brand system and the official emblem |
| `Downloads/ratatai` | Next.js services landing page with LT/RU/EN messages |

**Documents read:** `ARCHITECTURE.md`, `CURRENT_STATUS.md`, `FOUNDATION_ANALYSIS.md`,
`SUPABASE_SETUP.md`, plus all three applied migrations, `types/database.ts`,
`lib/utils/listing-specs.ts` and `lib/api/listings.ts`.

**Files named in the brief that do not exist anywhere on disk:**
`listing.contract.ts`, `listing.validation.ts`, `SUPABASE_DATA_CONTRACT.md`,
`SUPABASE_OWNER_CHECKLIST.md`, `001_initial_schema.sql`, `002_security_hardening.sql`.
They appear to be from an earlier session that was not saved. The applied
migrations were therefore used as the source of requirements.

**ratatai.com returned HTTP 403** at the time of the audit, so the brand analysis
was done from the complete local copy of the live site (`ratatai-site/`), which
includes `index.html`, `css/style.css` and the official `emblem.png`.

### Brand tokens taken from the live site

| Token | Value |
|---|---|
| Background | `#0a0a0b`, alt `#101114` |
| Card | `#15171c`, hover `#1b1e25` |
| Border | `#262a32`, strong `#39404b` |
| Text | `#f2f3f5`, muted `#9aa0aa`, faint `#6b7280` |
| Accent | `#e11d2a`, dark `#c4151f` |
| Radius | 16px / 22px · Shell width 1200px |
| Type | Sora (display), Inter (body) |
| Wordmark | `RATA` + red `TAI`, emblem at 40×40 |

Contacts reused: +370 643 95480 · ratatailt@gmail.com · Gariūnų g. 43 / EP31, Vilnius.

### Contract conflict and the decision taken

The applied migration and the brief's contract were incompatible:

| | Applied migration | Brief |
|---|---|---|
| Owner column | `seller_id` | `user_id` |
| Complete wheels | `ratai` | `komplektiniai_ratai` |
| Technical data | flat `text` columns | `specs` JSONB |
| Absent entirely | — | `currency`, `country`, `slug`, `updated_at`, `published_at`, `moderation_status` |
| Images | `sort_order` | `position` + `is_primary` |
| Bucket limit | 5 MB | 10 MB |

The old flat columns cannot hold the fields the brief requires (`tread_depth`,
`load_index`, `speed_index`, `xl`, `run_flat`, `studded`, `material`, `oem_code`),
so the schema had to change either way.

**Owner decision:** adopt the brief's contract, and write a non-destructive
compatibility migration. Owner also confirmed the live database contains only
test data.

**Reused from the old work:** the RLS shape (public read of active listings,
owner-only writes), the Storage path contract `{userId}/{listingId}/{file}`, the
MIME allow-list, the Lithuanian category vocabulary, and the brand system.

**Rewritten from scratch:** the entire application, the UI, the data contract,
validation, mapping, repositories, i18n and tests.

---

## Phase 1 — Foundation

Next.js 15 App Router, TypeScript `strict` with `noUncheckedIndexedAccess`,
Tailwind with the brand tokens above, locale routing under `/[locale]`,
environment validation that rejects placeholder and secret-looking keys,
Supabase browser/server clients and middleware session refresh.

i18n was built without a dependency: JSON dictionaries plus a typed accessor.
`ru.json` and `en.json` are typed as `Dictionary`, so a missing or extra key is a
build error. All three files verified at 340 leaf keys with identical ordering
and identical placeholder tokens.

## Phase 2 — Data contract

`src/domain/` holds canonical values, typed legacy mappers, the domain types,
strict Zod schemas per category, the row ↔ domain mapper and URL filter
serialization. Migrations `000` (non-destructive legacy archive), `001` (schema,
indexes, triggers, the public seller view) and `002` (RLS, policies, Storage).

Decisions worth recording:

- `moderation_status` exists in the schema but defaults to `approved`, because
  the MVP ships without a moderation panel. Switching the default is the single
  change needed to introduce a queue later.
- At most one primary image per listing is enforced by a partial unique index,
  and the 10-image cap by a trigger — not by application code alone.
- The public seller view is `SECURITY DEFINER` with its own `WHERE` clause, so
  `profiles` itself stays owner-only under RLS while buyers can still see a
  seller's name, city and (optionally) phone.

## Phase 3 — Public marketplace

Home, catalog, three category routes, listing detail, SEO. Filters live entirely
in the URL, so refresh and browser Back/Forward behave correctly. Technical
filters are applied as JSONB path comparisons and resolve to different paths per
category (`specs->width` for tyres, `specs->tire->width` for complete wheels).
A search query that looks like a tyre size becomes three exact numeric filters
instead of a LIKE.

## Phase 4 — Auth

Email and password, confirmation, recovery, reset, protected routes with a
preserved destination. Server actions return error codes rather than text, so
translation stays in the UI. Sign-up and recovery answer identically whether or
not the address exists.

## Phase 5–7 — Listings, images, dashboard

A six-step form generated from field descriptors, so a new spec field is one
descriptor plus one dictionary key. Entered data survives moving between steps.

The listing is created as a **draft** when the seller leaves the data steps,
because the Storage path needs the listing id. An abandoned form therefore
leaves a private draft rather than a half-finished public listing. Uploads use
`upsert: false`; a failed metadata insert deletes the objects that were just
uploaded, and deleting a listing removes its objects.

## Phase 8 — Legal

Privacy Policy and Terms of Use, 12 sections each, in all three languages,
written for this system specifically (no payments, no chat, no tracking).

## Phase 9 — QA

151 unit tests, 70 integration tests against a fake Supabase client, and 33
Playwright specs across desktop / mobile / 320px projects.

### Bugs found by independent review and fixed

The test suites were written by agents that had not seen the implementation
being written. They found ten real defects, all fixed in commit `fix/review`:

1. **`wheelSpecsSchema` could never accept a valid complete wheel.** Intersecting
   a `.strict()` object with another strict schema makes every real key
   "unrecognised" on the narrower side. Rewritten using `.extend()`. This was a
   category-breaking bug — complete wheels could not be published at all.
2. **`formatPrice` cached a formatter whose fraction digits depended on the first
   amount formatted.** `99.50 €` could render as `99,5 €` depending on render
   order. Cache is now keyed on locale *and* whole-vs-fractional.
3. **Spec validation issues collapsed onto a single `specs` key**, so per-field
   errors could never be shown next to the input. Sub-paths are now re-attached.
4. **The `price_precision` refinement was a tautology** and accepted sub-cent
   prices.
5. **Three dashboard redirects dropped the `next` parameter**, losing the
   visitor's destination.
6. **Six of eight repository functions created the Supabase client unguarded**,
   so a configuration error surfaced as an unhandled 500 instead of a translated
   error state.
7. **`addImages` ignored a read error** and could flag a second primary image,
   turning a transient blip into a failed upload.
8. **`reorderImages` never reconciled `is_primary`**, so reordering appeared to
   do nothing to buyers — the public sort is primary-first.
9. **The filter panel rendered two elements with the same `id`** and repeated the
   category in the query string on category routes.
10. **`isProtectedPath` matched by substring** rather than by path segment, and
    `getSiteUrl` treated a blank variable as valid, which would throw while
    building metadata.

### Known limitation

`npm install`, `tsc`, `vitest`, `playwright` and `next build` could **not** be
executed in the environment where this code was written: the npm registry is not
on that environment's network allow-list. The code was written carefully and
reviewed, but the Quality Gate in §27 of the brief must be run on a machine with
network access before launch:

```bash
npm install
npm run verify        # lint + typecheck + unit/integration tests + production build
npm run test:e2e      # after npm run build && npm run start
```

Expect to fix a small number of mechanical issues on the first run.
