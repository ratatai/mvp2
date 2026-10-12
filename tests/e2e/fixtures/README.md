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
