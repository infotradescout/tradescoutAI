import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TRANSACTION_CALLERS = [
  "server/badges/badgeEngine.ts",
  "server/xp/xpEngine.ts",
  "server/routes/tradepartner-campaigns.ts",
  "server/services/liveStreamSnapshotService.ts",
  "server/services/partnerCountyObservationSnapshotService.ts",
  "server/services/partnerIntelligenceBriefSnapshotService.ts",
];

describe("pooled transaction session contract", () => {
  it("does not issue transaction control through pool.query", () => {
    for (const relativePath of TRANSACTION_CALLERS) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      expect(source).toContain("withPoolTransaction");
      expect(source).not.toMatch(/pool\.query\(\s*["'`](?:BEGIN|COMMIT|ROLLBACK)/i);
    }
  });
});
