import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "server/services/adminProductionAcceptance.ts"),
  "utf8"
);

describe("production acceptance report language", () => {
  it("uses the four operating classifications", () => {
    expect(source).toContain("Genuinely Empty");
    expect(source).toContain("Unavailable");
    expect(source).toContain("Blocked");
    expect(source).toContain("Working");
  });

  it("states the rollback test boundary", () => {
    expect(source).toContain("one temporary database record and rolls it back");
    expect(source).toContain("no production business record persisted");
  });
});
