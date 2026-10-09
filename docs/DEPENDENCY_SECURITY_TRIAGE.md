# Dependency security triage

Status: **INCOMPLETE. Both critical findings are now identified (dev-only,
vitest toolchain). Three findings in the full audit are still unidentified
because the output was truncated. All audit findings stay release blockers.**

- Tested commit: `c393cc5b9ab22146d8049caa8b2f49cf8750c596`
  (branch `claude/quality-gate-and-runbook`, PR #5).
- Lockfile identity: `package-lock.json` git blob
  `a83b63b50ee01b46c76fb3c3a1c46b503cc145fb` at that commit.
- Executed: 2026-10-09, by the GitHub Claude executor. Not independently
  re-verified by the orchestrator.
- No `package.json`, lockfile, application, SQL or workflow change. No upgrades
  installed, no `npm audit fix`.

## 1. Commands run and exit codes

Each command was run once, separately, with no wrapper or redirection.

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `npm audit --package-lock-only --json` | 1 | 19 findings: 0 info, 0 low, 6 moderate, 11 high, 2 critical. Dependencies: prod 30, dev 452, optional 115, total 519 |
| 2 | `npm audit --omit=dev --package-lock-only --json` | 1 | 4 findings: 1 moderate, 3 high, 0 critical |
| 3 | `npm ci` | 0 | added 416 packages, audited 417; same 19 (6 moderate, 11 high, 2 critical) summary |
| 4 | `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u NEXT_PUBLIC_SITE_URL npm run build` | 0 | Next.js 15.5.25, `✓ Compiled successfully`, `✓ Generating static pages (54/54)` |

npm audit exits 1 whenever findings exist; that is expected, not a tool failure.

**Truncation gap in command 1.** The executor's tool output cut about 8 KB from
the middle of the JSON (between the `micromatch` entry and the `tinypool`
entry). The command was not rerun or piped elsewhere. Command 2 recovers the
four runtime entries in that alphabetical range (`next`, `postcss`, `sharp`,
`source-map-js`). By count, **1 high and 2 moderate findings remain
unidentified**, as does the first of the two `tinypool` advisories (only its
range `<=2.1.0` was visible). They are not named here because nothing in the
captured output names them.

The 19 is a per-package count, not a count of distinct advisories: parents are
flagged "via" children, and one package can carry several advisories.

## 2. Critical findings (both development-only)

| Package | Installed | Advisory | Severity | Affected range | Via / path | fixAvailable |
|---|---|---|---|---|---|---|
| `vitest` (direct dev) | 2.1.9 | [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp) "When Vitest UI server is listening, arbitrary file can be read and executed" (CVSS 9.8) | critical | `<3.2.6` | direct; also flagged via `@vitest/mocker`, `tinypool`, `vite`, `vite-node` | `vitest@5.0.3`, semver-major |
| `tinypool` | 1.1.1 | [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) "Tinypool: Prototype Pollution Gadget to RCE in run() options" | critical | `<2.1.2` | `vitest` → `tinypool`; second advisory (range `<=2.1.0`) truncated | `vitest@5.0.3`, semver-major |

Exposure: the npm audit with `--omit=dev` reports **0 critical**, so neither is
in the production dependency tree. Exposure is developer machines and CI that
run Vitest. GHSA-5xrq applies when the Vitest UI/API server is listening; this
repo runs `vitest` in CLI mode, but that is not a reason to close it.

## 3. High findings

### Runtime (present in `--omit=dev` output)

| Package | Installed | Advisories (severity, range) | Path | fixAvailable |
|---|---|---|---|---|
| `postcss` (nested) | 8.4.31 at `node_modules/next/node_modules/postcss` | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) high `<=8.5.11`; [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) high `<=8.5.17`; [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) moderate `<8.5.10`; [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) moderate `<=8.5.22` | `next` → `postcss` | `true` (non-major) |
| `sharp` (optional) | 0.35.4 | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) high, librsvg CVE-2026-96889, `<0.35.5` | `next` optional dep | `true` (non-major) |
| `source-map-js` | 1.2.1 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) high, event-loop DoS, `>=1.0.0 <1.2.2` | runtime transitive | `true` (non-major) |

The top-level dev `postcss` 8.5.28 is above every listed range; only the copy
nested under `next` is affected.

### Development-only

| Package | Installed | Advisory / via | Range | fixAvailable |
|---|---|---|---|---|
| `vite` | 5.4.21 | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) high (`server.fs.deny` bypass, Windows); plus moderate [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3); via `esbuild` | `<=6.4.2` | `vitest@5.0.3`, major |
| `braces` | 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) high, stack-exhaustion DoS | advisory `<=3.0.3`; npm flags `*` | `tailwindcss@4.3.3`, major |
| `micromatch` | 4.0.8 | via `braces` | `>=0.2.0` | truncated in output |
| `chokidar` | 3.6.0 | via `braces` → affects `tailwindcss` | `2.0.0 - 3.6.0` | `tailwindcss@4.3.3`, major |
| `fast-glob` | 3.3.1; 3.3.3 under `tailwindcss` | via `micromatch` | `*` | `eslint-config-next@14.2.35`, major |
| `@next/eslint-plugin-next` | 15.5.25 | via `fast-glob` | `>=14.3.0-canary.0` | `eslint-config-next@14.2.35`, major |
| `eslint-config-next` (direct dev) | 15.5.25 | via `@next/eslint-plugin-next` | `>=14.3.0-canary.0` | `eslint-config-next@14.2.35`, major |
| *1 more high* | — | **unidentified (truncated)** | — | — |

## 4. Moderate findings

| Package | Installed | Advisory | Range | Exposure | fixAvailable |
|---|---|---|---|---|---|
| `next` (direct) | 15.5.25 | [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676) SSG/ISR cache poisoning (self-hosted); [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) cross-user content substitution; via nested `postcss` | `>=15.0.0 <15.5.27` | runtime | `true` (non-major) |
| `@vitest/mocker` | 2.1.9 | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) path traversal; via `vite` | `>=2.1.0 <4.1.11` | dev | `vitest@5.0.3`, major |
| `esbuild` | 0.21.5 | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) dev-server CORS read | `<=0.24.2` | dev | `vitest@5.0.3`, major |
| `vite-node` | 2.1.9 | via `vite` | `<=2.2.0-beta.2` | dev | `vitest@5.0.3`, major |
| *2 more moderate* | — | **unidentified (truncated)** | — | — | — |

## 5. Smallest candidate fixes supported by the audit

Candidates only. None is applied or tested here.

1. **Runtime, non-major (`fixAvailable: true`)**: `next` to at least 15.5.27
   (advisory floor; within `^15.0.0`), `sharp` to at least 0.35.5,
   `source-map-js` to at least 1.2.2. Whether the chosen `next` release also
   moves its nested `postcss` above 8.5.22 is not shown by the audit and must be
   checked after the bump. Prefer a lockfile-only update; use `overrides` only
   if a parent pins the vulnerable child.
2. **Both criticals (dev)**: audit's only offered fix is `vitest@5.0.3`, a
   semver-major upgrade from 2.1.9 that also clears `vite`, `vite-node`,
   `@vitest/mocker`, `esbuild` and `tinypool`. Needs its own branch and a full
   Vitest rerun.
3. **`braces`/`chokidar` chain (dev)**: audit offers `tailwindcss@4.3.3`, a
   major Tailwind upgrade with config changes. Not a small fix.
4. **`fast-glob`/`eslint-config-next` chain (dev)**: audit offers
   `eslint-config-next@14.2.35`, a major **downgrade** that would mismatch
   `next` 15. Not acceptable as proposed; needs a different resolution or an
   explicit owner acceptance note.

## 6. Build result: compile validation only

Command 4 proves that, with the three `NEXT_PUBLIC_*` variables explicitly
unset, `next build` exits 0 and generates 54/54 pages, with per-user routes
rendered on demand. It is **not** a deployable build: a deployment needs the
real public Supabase URL, anon key and site URL, and that build has not been
run here.

## 7. Release-blocker status

| Item | Status |
|---|---|
| 2 critical (`vitest`, `tinypool`) | **Identified, dev-only, unfixed. Release blocker** until fixed or owner-accepted |
| 3 runtime high (`postcss` nested, `sharp`, `source-map-js`) | **Identified, unfixed. Release blocker** |
| 7 dev high identified + 1 high unidentified | **Release blocker** |
| 4 moderate identified + 2 unidentified | **Release blocker** until each is fixed or accepted |
| No-env compile | Passed (exit 0, 54/54), 2026-10-09 |
| Deployable build with real public variables | Not run |

No finding is closed by this document. A finding is cleared only by a recorded
fix or by an explicit, owner-approved acceptance note.

## 8. Next validation plan

1. Recover the truncated part of command 1 (1 high, 2 moderate, first
   `tinypool` advisory), for example by saving the JSON as a CI artifact in an
   approved environment. Record names, advisories and `fixAvailable` here.
2. On a separate task branch, apply the runtime non-major bumps from §5.1,
   rerun both audits and confirm the nested `postcss` version.
3. On a separate branch, evaluate `vitest@5.0.3` for the two criticals.
4. Decide the Tailwind and `eslint-config-next` chains (fix or written
   acceptance).
5. After each change run `npm ci`, `npm run lint`, `npm run typecheck`,
   `npm run test` and `npm run build`, recording real exit codes. Never use
   `npm audit fix --force`. Playwright stays on a local disposable stack as
   `E2E_SAFETY.md` requires.
