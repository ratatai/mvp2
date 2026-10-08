# Dependency security triage

Status: **INCOMPLETE. The two critical findings are not identified yet. All
audit findings stay release blockers.**

- Snapshot: `package-lock.json` at commit `447856507c30d97f1f21f9aee0989d0e5d89b61c`
  (branch `claude/quality-gate-and-runbook`, PR #5).
- Prepared: 2026-10-08, as static triage only. No `package.json`, lockfile,
  application, SQL or workflow change. No upgrades installed, no `npm audit fix`.

## 1. What is actually known

The only audit evidence is the aggregate summary that `npm ci` printed in the
earlier regression-test run on this branch:

> 19 vulnerabilities (6 moderate, 11 high, 2 critical)

No audit payload exists, meaning no JSON or per-advisory `npm audit` output.
So:

- The **19 is a count of findings that npm reported, not of distinct advisories.**
  npm counts per vulnerable package, and one advisory can mark several packages
  (for example, a parent marked vulnerable "via" a child), while one package can
  carry several advisories. The number of distinct advisories is unknown.
- The **package names, advisory IDs, affected ranges and patched versions behind
  the 2 critical findings are unknown.** This document does not name them,
  because any name would be a guess.

## 2. Why the critical findings could not be identified in this run

| Needed evidence | Attempt in this run | Result |
|---|---|---|
| `npm audit --package-lock-only --json` (read-only, no install) | One attempt | Blocked by the run's permission settings ("requires approval") |
| GitHub Advisory Database REST API (`api.github.com/advisories?ecosystem=npm&severity=critical`) | One `WebFetch` | Blocked (tool permission not granted) |
| Web search for primary advisories | One `WebSearch` | Blocked (tool permission not granted) |

No permissions were raised and no denied command was retried. With none of the
three primary sources available, nothing in this document is confirmed against
an advisory.

## 3. Installed versions (confirmed from `package-lock.json`)

The lockfile is v3 with 519 `node_modules/*` entries, including optional
platform binaries. The earlier `npm ci` added 416 packages on linux-x64.

### Direct runtime dependencies (shipped to production)

| Package | Range in `package.json` | Locked version | Lockfile flag |
|---|---|---|---|
| `next` | `^15.0.0` | 15.5.25 | runtime |
| `react` | `^19.0.0` | 19.3.0 | runtime |
| `react-dom` | `^19.0.0` | 19.3.0 | runtime |
| `@supabase/ssr` | `^0.10.3` | 0.10.3 | runtime |
| `@supabase/supabase-js` | `^2.105.4` | see lockfile | runtime |
| `zod` | `^3.23.8` | see lockfile | runtime |

Runtime transitive packages relevant to the request path:

- `node_modules/next/node_modules/postcss` **8.4.31**: a nested copy pinned by
  `next`, separate from the top-level dev `postcss` 8.5.28.
- `nanoid` 3.3.19.
- `cookie` 1.1.1, used by `@supabase/ssr`.
- `sharp` 0.35.4, an optional `next` dependency for image optimisation.

### Direct development dependencies (not shipped; CI/local exposure only)

| Package | Locked version | Lockfile flag |
|---|---|---|
| `vitest` (+ `@vitest/*`) | 2.1.9 | dev |
| `vite` (via vitest) | 5.4.21 | dev |
| `esbuild` (via vite) | 0.21.5 | dev |
| `rollup` (via vite) | 4.63.4 | dev |
| `eslint-config-next` | 15.5.25 | dev |
| `@playwright/test` / `playwright` | 1.63.0 | devOptional |
| `postcss` (top-level) | 8.5.28 | dev |
| `cross-spawn` | 7.0.6 | dev |
| `glob` | 7.2.3 (npm marks this release deprecated) | dev |
| `minimatch` / `brace-expansion` | 3.1.5 / 1.1.21 (top-level); 10.2.6 / 5.0.12 nested under `@typescript-eslint/typescript-estree` | dev |
| `picomatch` | 2.3.2 (top-level); 4.0.7 nested under `tinyglobby` | dev |
| `js-yaml` | 4.3.2 | dev |
| `semver` | 7.8.5 (top-level); 6.3.1 nested under eslint plugins | devOptional / dev |

### Packages confirmed **absent** from the lockfile

These packages often appear in critical npm advisories. None of them has a
`node_modules/<name>` entry, so they cannot be behind the 2 critical findings:
`form-data`, `pbkdf2`, `sha.js`, `cipher-base`, `elliptic`, `tar`, `ws`,
`undici`, `axios`, `path-to-regexp`, `happy-dom`, `jsdom`, `tmp`, `devalue`,
`@babel/helpers`, `react-server-dom-webpack` (Next.js vendors its own RSC build
inside `next`).

### Runtime vs development exposure

Until the critical identities are known, exposure can only be bounded:

- If a critical finding sits in `next`, `react`/`react-dom`, `@supabase/*`,
  `zod` or the nested `next/node_modules/postcss`, it affects **production**.
  Treat it as an immediate release blocker.
- If it sits only in packages marked `dev` or `devOptional` (the vitest/vite/esbuild
  toolchain, the eslint toolchain, Playwright), it affects developer machines
  and CI, not the deployed app. It still blocks release under this document's
  policy until someone records an explicit triage decision.

## 4. Earlier advisories checked from memory (not evidence)

The executor recalls a few advisories from before its knowledge cutoff, and the
locked versions are at or above the fixed versions it recalls for each. **This
was not checked against a primary source in this run, cannot identify the
current 2 critical findings, and must be re-checked in §6:**

- `next`: CVE-2025-29927 (middleware authorization bypass), recalled fix 15.2.3.
  CVE-2025-66478 (RSC remote code execution), recalled fix 15.5.7 on 15.5.x.
  Locked version: 15.5.25.
- `vitest`: CVE-2025-24964 (remote code execution through the API server),
  recalled fix 2.1.9 on 2.x. Locked version: 2.1.9.

Advisories published after the cutoff, in any of the 519 entries, are not
covered.

## 5. Release-blocker status

| Item | Status |
|---|---|
| 2 critical findings: package, advisory, range, fix | **Unidentified. Release blocker.** |
| 11 high findings | **Untriaged. Release blocker.** |
| 6 moderate findings | **Untriaged. Release blocker** until each is explicitly accepted or fixed |
| Distinct advisory count behind the 19 | Unknown |
| Build with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` explicitly unset | **Still unresolved** (separate task; not rerun here) |

No finding may be closed by this document. A finding is cleared only by a
recorded fix or by an explicit, owner-approved acceptance note.

## 6. Next validation plan

1. In an environment that allows it, run **`npm audit --package-lock-only --json`**
   against this exact lockfile. It reads only and installs nothing. Commit the
   critical and high entries (names, `via` chains, `range`, `fixAvailable`) to
   this file.
2. For each critical finding, open the GitHub Advisory Database entry
   (`https://github.com/advisories/GHSA-…`) and the upstream vendor advisory.
   Record the GHSA/CVE ID, affected range and first patched version.
3. Get the exact dependency path with `npm ls <package> --all` or
   `npm explain <package>`. Classify it as runtime or dev from the lockfile
   `dev`/`devOptional` flags.
4. Pick the **smallest** patched version that the existing `package.json`
   ranges allow. Prefer a lockfile-only bump. Use `overrides` only if a parent
   pins a vulnerable child, and never use `npm audit fix --force`.
5. On a separate task branch, apply the bump and run `npm ci`, `npm run lint`,
   `npm run typecheck`, `npm run test` and `npm run build`. Record the real exit
   codes. Playwright stays on a local disposable stack, as `E2E_SAFETY.md`
   requires, and is out of scope here.
6. Repeat steps 2–5 for the 11 high findings, then decide the 6 moderate
   findings (fix or accept with a written reason).
