import { describe, expect, it } from "vitest";
import { assertDisposableFullSyncTarget } from "../../scripts/lib/test-db-safety.mjs";

describe("disposable test database full-sync safety", () => {
  it("requires an explicit full-sync opt-in", () => {
    expect(() =>
      assertDisposableFullSyncTarget("postgresql://local:local@127.0.0.1:5546/tradescout_test", {})
    ).toThrow(/ALLOW_TEST_DB_FULL_SYNC=true/);
  });

  it.each([
    "postgresql://local:local@127.0.0.1:5546/tradescout",
    "postgresql://local:local@127.0.0.1:5546/tradescout_production",
    "postgresql://local:local@database.internal:5432/tradescout_test",
  ])("rejects an unsafe target: %s", (url) => {
    expect(() => assertDisposableFullSyncTarget(url, { ALLOW_TEST_DB_FULL_SYNC: "true" })).toThrow(
      /Refusing/
    );
  });

  it("accepts an explicitly authorized loopback disposable database", () => {
    expect(
      assertDisposableFullSyncTarget("postgresql://local:local@127.0.0.1:5546/tradescout_test", {
        ALLOW_TEST_DB_FULL_SYNC: "true",
      })
    ).toMatchObject({
      database: "tradescout_test",
      hostname: "127.0.0.1",
      loopback: true,
    });
  });

  it("requires two explicit CI controls for a remote disposable target", () => {
    expect(
      assertDisposableFullSyncTarget("postgresql://ci:ci@database.internal:5432/tradescout_ci", {
        ALLOW_TEST_DB_FULL_SYNC: "true",
        ALLOW_REMOTE_TEST_DB_FULL_SYNC: "true",
        CI: "true",
      })
    ).toMatchObject({ database: "tradescout_ci", loopback: false });
  });

  it.each([
    "host=remote.example",
    "host=%2Fvar%2Frun%2Fpostgresql",
    "port=5433",
    "dbname=production",
  ])("rejects hidden connection-target overrides before full sync: %s", (query) => {
    expect(() =>
      assertDisposableFullSyncTarget(
        `postgres://tester:synthetic@127.0.0.1/request_flow_test?${query}`,
        { ALLOW_TEST_DB_FULL_SYNC: "true" }
      )
    ).toThrow("connection target overrides");
  });
});
