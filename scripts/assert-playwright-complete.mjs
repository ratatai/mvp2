/** Fail closed when a selected Playwright gate omits or skips any scenario. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const [path, count] = process.argv.slice(2);
const expected = Number(count);
assert(path && Number.isInteger(expected) && expected > 0, 'Usage: report.json expected-test-count');
const report = JSON.parse(readFileSync(path, 'utf8'));
const tests = [];
function walk(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) tests.push(test);
  for (const child of suite.suites ?? []) walk(child);
}
for (const suite of report.suites ?? []) walk(suite);
assert.equal(report.errors?.length ?? 0, 0, 'Global test errors');
assert.equal(tests.length, expected, 'Discovered test count');
assert.equal(report.stats.expected, expected, 'Passed test count');
for (const key of ['skipped', 'unexpected', 'flaky']) assert.equal(report.stats[key], 0, key);
assert(tests.every(test => test.status === 'expected' && test.results.length === 1 && test.results[0].status === 'passed'),
  'Each test must pass on its first attempt');
console.log(`Verified ${expected}/${expected} passed, zero skipped, failed, flaky or retried.`);
