# RATATAI MVP audit roadmap

Date: 2026-10-18. Scope: marketplace tyres, rims, complete wheels; LT/RU/EN.
This is an execution contract and handoff, not an audit completion certificate.
No roadmap can certify absence of every bug or vulnerability.

## Candidate and evidence rules
- Current application candidate: PR24, 01b21f21479e8ae5d6ec8cafcb9e397ee93ad3f1, based on PR22 fd413096c90444f9547761563115d49cda26cc9e.
- Freeze one final application SHA before release regression. Any candidate change marks affected gates STALE; assess shared dependencies before retaining other results.
- Main is a different tree. Do not test main and claim the application stack passed.
- Read current main CLAUDE.md, README.md, E2E_SAFETY.md and candidate instructions first.
- Every gate returns PASS, FAIL, BLOCKED, NOT_RUN or STALE. Missing evidence, skipped tests, an author's claim or a prepared spec are never PASS.
- Historical runs prove their pinned SHA only. Keep workflow SHA, application SHA, run/job URL, exact command, exit status, expected/passed/failed/skipped counts and sanitized evidence.
- The executor reports findings; the orchestrator independently inspects evidence and prepares focused fix PRs. No automatic merge or deploy.
- Never read production env files, credentials or private customer records. No hosted SQL, migrations, resets, repair, deletion, billing or remote writes.
- E2E: NEW disposable local Supabase PG17, loopback only, synthetic accounts, own Playwright build/server. Preserve guard; discard only the stack created by the run. Never borrow the owner's existing local database.
- Keep tyre width unrestricted by a 305 cap; full tyre/rim/wheel fields, ET from/to, locale parity. No invented vehicle fitment.

## Required gates
All rows are NOT_RUN on the final release SHA until evidence is supplied.

| ID | Gate | Required evidence and acceptance |
| --- | --- | --- |
| A01 | Repository and scope | Exact candidate/base SHA, clean checkout, changed files and PR chain; identify unmerged dependencies. No unrelated Telegram bot or workflow changes. |
| A02 | Reproducible install | Node24, npm ci from committed lock; no lock mutation or engine conflict; record versions and exit. |
| A03 | Code quality | npm run lint, npm run typecheck, npm test, npm run build; all exit0, test totals and route/build result. Run sequentially; no forced fixes. |
| A04 | Dependencies | npm audit --json and npm audit --omit=dev --json; preserve nonzero status and advisory paths. No blanket risk acceptance. braces finding remains open pending current verification/remediation or explicit owner decision. |
| A05 | Canonical contract | Inspect validation, mappers, repositories, forms and filters. Verify all three categories, width/aspect/diameter, rim diameter/width/PCD/CB/ET, wheels combined, ET endpoints, absent optional values; no 305 cap. Map each requirement to a test or finding. |
| A06 | Database and access | Fresh PG17 migration apply count; cross-user-isolation.mjs evidence for anonymous/owner/other user, listings/images/storage/profile public visibility and ownership. Review RLS, views, grants, functions and search_path. Negative cases must run. |
| A07 | Authentication | auth-session.spec.ts plus relevant auth/access-control cases; LT login, reload/session retention, logout/protected page denial, RU/EN redirects; no unexpected skips. Isolate logout from shared-account lifecycle. |
| A08 | Seller journey | listing-lifecycle.spec.ts on desktop once with local synthetic account; three categories, photos, edit/order/primary image and status transitions where implemented; report uncovered cases separately. Verify ownership and no fabricated fields. |
| A09 | Search and results | search-filters, rim-et-results, tyre-results, wheel-results specs on desktop/mobile/narrow; expected titles/counts, boundaries and returned rows, reset/query preservation, empty/malformed filters. Vehicle mode must disclose unavailable verified fitment data. |
| A10 | Mobile navigation | mobile-nav.spec.ts: four checks, zero skipped/flaky/failed; Tab wrap, Escape, close focus return, 375→1024 scrolling restored. Prepared workflow pins PR24. |
| A11 | Responsive and languages | responsive.spec.ts, i18n.spec.ts, catalog.spec.ts as applicable; screenshots/manual evidence at320/375/1440 for LT/RU/EN: home/results/detail/login/create/dashboard. Check overflow, touch targets, focus, labels and untranslated text. Structural dictionary parity alone is insufficient. |
| A12 | Application security | Review server actions and repository boundary, authorization/IDOR, stored/reflected XSS, redirect allowlist, input validation, image type/size/count, raw error leakage, session handling and public seller data. Map each issue to file/line and safe local proof. No hostile load/DoS or hosted tests. |
| A13 | Public routes and product content | Broken links, not-found/empty/error pages, metadata/sitemap/robots, legal/contact text and locale paths; confirm seller/contact exposure matches product. Separate owner business/legal decisions from code defects. |
| A14 | Release assembly | After fixes, rerun affected gates on final SHA and verify PR integration. Document remaining advisories, untested cases, preview/DB migration/backup/rollback plan. Owner approval for merges, hosted changes and publication remains separate. |

## Known historical evidence (not final-release PASS)
- PR22 fd413096: independently npm ci, 337 tests/17 files, lint, build54, byte-identical CSS; runtime audit0; one braces advisory represented by7 dev dependency entries.
- PR24 01b21f21: independently 337 tests, lint and typecheck; mobile browser spec NOT_RUN.
- Auth run38956102272:3 browser tests passed at application3da663045792989fffdb618f78c6d469478a7556.
- Earlier search69, rims30, wheels30, tyres21 and cross-user8 checks ran successfully on their own pinned commits. Retrieve jobs/logs before reusing evidence.
- No Docker/Supabase CLI in the current orchestrator workspace. Mobile E2E execution is BLOCKED here; a workflow PR is preparation only.

## Execution batches for Claude Code
Do not send the whole audit as one 25-minute paid task.
Choose ONE batch per authorized invocation: A01-A03; A04-A05; A12; or one browser gate A06/A07/A08/A09/A10/A11.
A13 is a separate bounded inspection; A14 belongs to orchestrator/owner.
Target12 turns; hard25 turns/25minutes. No subagents, limit increases, recursive mentions, autonomous paid chains or retry after permission denial.
Before launch, inspect active workflows and equivalent PR comments. Do not duplicate work. A failed paid attempt needs a changed cause before retry.
Browser batches require an approved execution route; new/changed workflows beyond the mobile preparation scope need owner approval.
Stop at the budget with precise partial results. Never label the entire audit complete because one batch finished.

### First read-only batch prompt (ready to copy, not dispatched)
Read current main instructions and this roadmap. Pin candidate PR24 SHA01b21f21479e8ae5d6ec8cafcb9e397ee93ad3f1. Review A05 only: trace full category contract through domain validation/mappers/repositories/forms/search, identify exact test coverage and concrete missing cases. No installs, browser/server/DB execution, credentials, edits, commits or workflow changes. Report each subrequirement with file references and PASS/FAIL/BLOCKED/NOT_RUN; static inspection is not executed test evidence. Target12 turns, hard25/25min; no subagents, retries of denied commands, further mention triggers or task chains. End with unresolved questions for the orchestrator.

## Per-gate handoff (mandatory JSON object)
```json
{
  "gate_id": "A10",
  "application_sha": "01b21f21479e8ae5d6ec8cafcb9e397ee93ad3f1",
  "workflow_sha": null,
  "status": "NOT_RUN",
  "executor": "not assigned",
  "command": null,
  "exit_code": null,
  "counts": {"expected": 4, "passed": 0, "failed": 0, "skipped": 0},
  "run_url": null,
  "job_url": null,
  "evidence": [],
  "findings": [],
  "coverage_gaps": ["No browser execution yet"],
  "owner_decision": null
}
```
For a finding include severity, file:line, trigger/reproduction, expected/actual, affected gate IDs and proposed minimal fix. Never attach env files, tokens, session traces, database dumps or user data.

## Completion and feedback loop
1. Executor completes a bounded batch and posts its gate records in the appropriate PR; no follow-on paid trigger.
2. Orchestrator reads actual diff/jobs/logs, rejects unsupported PASS and records findings.
3. Orchestrator implements minimal fixes in a branch/PR and verifies them; fix author report is not independent verification.
4. Rerun affected gates, retaining exact old/new SHA links; do not rerun unchanged gates without a reason.
5. Release audit is complete only when A01-A14 are evidenced on the candidate, failures resolved, gaps explicit and required owner decisions recorded. Residual vulnerability acceptance must be explicit, never inferred.

## Automation boundary
This file does not start a process. Existing webhook/hourly checks can collect reports and coordinate within their saved authorization, but do not execute the entire roadmap by reading it.
A fully unattended runner for all gates, scheduled paid tasks, new triggers or broader workflows is NOT created or approved by this document.
The owner must review any proposed execution/merge/dispatch scope separately. No promise of permanent or unlimited autonomous operation.
