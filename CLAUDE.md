# RATATAI development instructions

Read README.md and E2E_SAFETY.md before working. Inspect the current files and report facts, not assumptions from earlier chats.

## Scope
- Marketplace for tyres, rims and complete wheels. Lithuanian default; Russian and English supported.
- Preserve tyre width/aspect ratio/diameter and rim diameter/width, PCD, center bore and ET fields. Do not cap tyre width at 305.
- Keep database access in src/lib/repositories and preserve the canonical data contract.
- Make focused changes on a task branch and prepare a pull request. Never merge or deploy automatically.
- Do not modify GitHub workflows or these instructions unless the owner's task explicitly requests it.

## Database and credentials
- Do not apply SQL, migrations, seeds or resets to any remote Supabase project as part of a coding task.
- Prepare proposed schema changes as migration files and explain their effects for review.
- Do not assume an empty database is a disposable test database.
- Preserve RLS, owner checks and storage ownership rules.
- Never read, print, commit or put credentials in issues or pull requests. Never put a service_role key in NEXT_PUBLIC variables.
- The current GitHub executor has no configured remote Supabase access. Report missing configuration clearly rather than inventing credentials.
- A local untracked reconcile migration may exist on the owner's computer. Do not recreate or apply it based solely on its filename.

## Validation and reporting
- Use npm ci with the committed package-lock.json.
- Run lint, typecheck, Vitest tests and build as appropriate. Report existing failures separately from failures introduced by the change.
- Run E2E only with the local Supabase configuration specified in E2E_SAFETY.md.
- If blocked, report the exact blocker. Never claim a check passed without running it.
- Summarize changed behavior, checks and unresolved issues in the pull request.
