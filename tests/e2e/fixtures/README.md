# E2E fixtures

## `rim-et-results.sql`: rim ET result matching

Used by `tests/e2e/rim-et-results.spec.ts`. Thirteen synthetic rims: three
public matches (PCD 5x112, CB 57.1, R17, ET −10/0/40), two public ET misses
(−11, 41), three public rims with a different PCD, CB or diameter, and five
non-public rims (draft, sold, archived, pending, rejected) that must never
appear. No photos, phones or other contact data.

**Local disposable stacks only.** Never load it into a hosted, staging or
production project. Follow [E2E_SAFETY.md](../../../E2E_SAFETY.md).

Runner prerequisites, in order:

1. A **new** local stack (`supabase start`) with `db.major_version = 17` and
   the migrations applied. The demo seed must be off, so the catalog is empty.
2. A loopback API URL (`http://127.0.0.1:54321` or similar) and the local anon
   key in the environment, as for every E2E run.
3. A **synthetic owner** created in that local stack only, with an email like
   `e2e-rim-owner@example.test`. Signing up creates the profile row.
4. Load the fixture through the database container's socket:
   ```bash
   docker exec -i supabase_db_<project_id> \
     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
          -v owner_email=e2e-rim-owner@example.test \
     < tests/e2e/fixtures/rim-et-results.sql
   ```
   The script aborts and rolls back if the server is not local or not PG17,
   if the owner is missing, has no profile or isn't `e2e-*@example.test`, or if
   `public.listings` is not empty.
5. Run only the result spec with `E2E_RIM_ET_FIXTURE=loaded`. Without the flag
   it skips itself.
6. Throw the stack away: `supabase stop --no-backup`.

## `wheel-results.sql`: complete-wheel result matching

Used by `tests/e2e/wheel-results.spec.ts`. Fifteen synthetic rows. Complete
wheels use the canonical nested shape (`specs.tire` / `specs.rim`, same
diameter on both halves):

- three public matches (tyre 225/45 R17, rim 5x112 CB 57.1, ET −10/0/40);
- two public ET misses (−11, 41);
- five public near-misses, each differing in one field: tyre width, profile,
  diameter (both halves), rim PCD, rim CB;
- one public 355/25 R22 wheel (width is not capped at 305);
- two non-public wheels (draft, pending) that must never appear;
- one plain tyre and one plain rim whose flat specs would match the wheel
  query; they must never appear on the complete-wheel route.

No photos, phones or other contact data.

Prerequisites are the same as for the rim fixture, in a **separate** new stack
(each fixture requires an empty catalog):

1. New local PG17 stack, migrations applied, demo seed off.
2. Loopback API URL and the local anon key only.
3. A synthetic owner such as `e2e-wheel-owner@example.test`, created locally.
4. Load through the container socket:
   ```bash
   docker exec -i supabase_db_<project_id> \
     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
          -v owner_email=e2e-wheel-owner@example.test \
     < tests/e2e/fixtures/wheel-results.sql
   ```
   Same guards and rollback as the rim fixture; it also aborts unless exactly
   15 rows were inserted.
5. Run only the wheel spec with `E2E_WHEEL_FIXTURE=loaded`.
6. Throw the stack away: `supabase stop --no-backup`.

## `tyre-results.sql`: plain tyre result matching

Used by `tests/e2e/tyre-results.spec.ts`. Fifteen synthetic rows. Plain tyres
use the canonical flat shape and canonical seasons:

- three public 205/55 R16 matches, one per season (summer, winter,
  all_season);
- three public near-misses, each differing in one field: width, profile,
  diameter;
- two public wide tyres, 355/25 R22 and 375/40 R22 (width is not capped at
  305);
- five non-public tyres (draft, sold, archived, pending, rejected) that must
  never appear;
- one complete wheel (nested 205/55 R16) and one plain R16 rim that would
  match the tyre query; they must never appear on the tyre route.

No photos, phones or other contact data.

Prerequisites are the same as for the other fixtures, in a **separate** new
stack (each fixture requires an empty catalog):

1. New local PG17 stack, migrations applied, demo seed off.
2. Loopback API URL and the local anon key only.
3. A synthetic owner such as `e2e-tyre-owner@example.test`, created locally.
4. Load through the container socket:
   ```bash
   docker exec -i supabase_db_<project_id> \
     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
          -v owner_email=e2e-tyre-owner@example.test \
     < tests/e2e/fixtures/tyre-results.sql
   ```
   Same guards and rollback as the rim fixture; it also aborts unless exactly
   15 rows were inserted.
5. Run only the tyre spec with `E2E_TYRE_FIXTURE=loaded`.
6. Throw the stack away: `supabase stop --no-backup`.

## Seller lifecycle spec (`listing-lifecycle.spec.ts`)

This spec writes data (three listings, image rows, Storage objects), so it
runs once, in the desktop project, in serial mode. It needs no SQL fixture.

1. A **new** local Supabase stack (PG17, migrations applied, loopback URL and
   local anon key), as `E2E_SAFETY.md` requires. Storage must be running.
2. A synthetic, confirmed user created in that stack only, whose address is on
   `example.test` or `example.invalid` (e.g. `seller@example.invalid`), with a
   `profiles` row. Pass it as `E2E_EMAIL` / `E2E_PASSWORD`.
   - Both unset: the spec is skipped.
   - Any other domain: the spec fails before sign-in.
3. Run only `listing-lifecycle.spec.ts --project=desktop`.
4. The spec archives its listings and asserts the archived state after a
   reload; it does not delete them. Discard the stack afterwards with
   `supabase stop --no-backup`.

Creating the user is not automated by any workflow yet.

## Cross-user isolation script (`cross-user-isolation.mjs`)

A plain Node script (no browser) that checks RLS on `listings` and
`listing_images` and the `listing-images` Storage policies with two real
users. Owner A creates one draft tyre, one 1x1 PNG at
`<A id>/<listing id>/e2e-iso-owner.png` and one image row; user B then tries
to read, update, publish, reassign and delete the listing, insert/update/delete
image metadata, and upload, replace, move and remove the object. A zero-row
"success" counts as refused only after A re-reads unchanged rows; after B's
`remove()`, A's object must still be byte-identical. Public reads of the image
file are not tested: the bucket is public by design.

1. A **new** local stack (PG17, migrations applied, Storage running, demo seed
   off so the catalog is empty).
2. Two confirmed synthetic users created in that stack only, on
   `example.test` or `example.invalid`, each with a `profiles` row.
3. Run with only these variables (no env file is loaded):
   ```bash
   E2E_ISO_SUPABASE_URL=http://127.0.0.1:54321 \
   E2E_ISO_ANON_KEY=<local anon key> \
   E2E_ISO_A_EMAIL=iso-a@example.test E2E_ISO_A_PASSWORD=<...> \
   E2E_ISO_B_EMAIL=iso-b@example.test E2E_ISO_B_PASSWORD=<...> \
   node tests/e2e/cross-user-isolation.mjs
   ```
   Before any request it refuses a non-loopback or non-`http` URL, a
   service_role/secret key, and non-synthetic or identical emails. Its fetch
   refuses other origins and redirects; sessions are not persisted. It prints
   check names and status codes only. Exit 0 means all 8 checks passed.
4. The rows and object are left for inspection; discard the stack with
   `supabase stop --no-backup`. No workflow runs this yet.

## Auth session spec (`auth-session.spec.ts`)

Anonymous → `/lt/naujas-skelbimas` redirects to login with `next`; UI login
returns there; one reload keeps the session; UI logout on `/lt/mano`; the page
is denied again. RU/EN anonymous redirects are checked without signing in.

1. A **new** local stack with a loopback URL and the local anon key.
2. One confirmed synthetic user on `example.test` or `example.invalid`,
   created in that stack only, passed as `E2E_EMAIL`/`E2E_PASSWORD`. The spec
   never creates users; without both variables the login test is skipped.
3. Run it on its own, not alongside `listing-lifecycle.spec.ts`: logout
   revokes the account's sessions. It runs in the desktop project only.
4. Discard the stack with `supabase stop --no-backup`. No workflow runs this yet.
