import test from "node:test";
import assert from "node:assert/strict";
import { assertDatabaseProof } from "./database-bootstrap.native.mjs";

const source = "a".repeat(40);
const options = { source, fullRelease: true, startedAfter: Date.parse("2026-09-07T00:00:00Z") };
const valid = () => ({
  source, passed: true, databaseCleanup: "stopped",
  startedAt: "2026-09-07T00:00:01Z", completedAt: "2026-09-07T00:01:00Z",
  scenarios: [
    ...Array.from({ length: 9 }, (_, index) => ({ name: `native-case-${index}`, passed: true })),
    { name: "exact-candidate built browser proof in a separate worktree", passed: true },
    { name: "complete minimum release contract with production assets and guarded test database", passed: true },
    { name: "built production migration entrypoint also rejects the incomplete database", passed: true },
  ],
});
test("accepts a complete current exact-source report", () => assert.doesNotThrow(() => assertDatabaseProof(valid(), options)));
test("rejects failed reports even if the child reported exit zero", () => {
  assert.throws(() => assertDatabaseProof({ ...valid(), passed: false }, options), /failed report/);
  assert.throws(() => assertDatabaseProof({ ...valid(), failure: "synthetic failure" }, options), /no failure/);
});
test("rejects incomplete, skipped or repeated scenarios", () => {
  const missing = valid(); missing.scenarios.pop();
  assert.throws(() => assertDatabaseProof(missing, options), /Every required scenario/);
  const failed = valid(); failed.scenarios[3].passed = false;
  assert.throws(() => assertDatabaseProof(failed, options), /Every scenario/);
  const duplicate = valid(); duplicate.scenarios[2] = duplicate.scenarios[1];
  assert.throws(() => assertDatabaseProof(duplicate, options));
});
test("rejects a wrong or stale candidate report", () => {
  assert.throws(() => assertDatabaseProof({ ...valid(), source: "b".repeat(40) }, options), /exact candidate/);
  assert.throws(() => assertDatabaseProof({ ...valid(), startedAt: "2026-09-06T23:00:00Z" }, options), /Stale proof/);
});
test("requires database cleanup and valid completion evidence", () => {
  assert.throws(() => assertDatabaseProof({ ...valid(), databaseCleanup: "failed" }, options), /cleanup/);
  assert.throws(() => assertDatabaseProof({ ...valid(), completedAt: null }, options), /completion time/);
  assert.throws(() => assertDatabaseProof({ ...valid(), cleanupWarning: "synthetic cleanup problem" }, options), /cleanup warning/);
});
test("cannot relabel a partial run as complete release proof", () => {
  const report = valid(); report.scenarios[10].name = "unrelated check";
  assert.throws(() => assertDatabaseProof(report, options), /Missing complete minimum release contract/);
});
