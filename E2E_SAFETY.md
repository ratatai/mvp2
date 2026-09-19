# E2E safety

The Playwright suite signs in, creates listings and uploads photos. It must
never touch a hosted Supabase project.

## Rules

- **E2E runs only against a local Supabase stack** (`supabase start`).
  `playwright.config.ts` stops before any server or test starts unless
  `NEXT_PUBLIC_SUPABASE_URL` points at `localhost`, `127.0.0.1` or `[::1]`.
- **Never run E2E with the production `.env.local`.** Pass the local values
  through the environment instead; they take precedence over `.env.local`.
- **Playwright always builds and starts its own server** on
  `http://127.0.0.1:3100`, with the local environment. It never attaches to a
  running server: if the port is busy, the run fails.
- **The seller lifecycle spec writes data.** It creates three listings, their
  image rows and Storage objects, publishes them, then archives them — it does
  not delete them. It runs once, in the desktop project only, and only when
  `E2E_EMAIL` and `E2E_PASSWORD` belong to a synthetic user created in the
  local stack. Every other spec is read-only.
- **Reset the local database after a run** (`supabase db reset`, or
  `supabase stop --no-backup`).
- **Rebuild `.next` before deploying.** An E2E run leaves a build that only
  knows the local stack. Build again with the production environment before
  any deployment.

## Variables (names only)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Local API URL — required, loopback only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local anon key — required, so the key in `.env.local` is never used |
| `E2E_EMAIL`, `E2E_PASSWORD` | Synthetic local user — optional; without them the lifecycle spec is skipped |
| `CI` | Optional; `true` enables one worker, one retry and `forbidOnly` |

## Running

```bash
supabase start          # prints the local API URL and anon key
supabase db reset       # applies supabase/migrations
npm run test:e2e:install
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key> \
npm run test:e2e
supabase db reset       # remove what the run created
```
