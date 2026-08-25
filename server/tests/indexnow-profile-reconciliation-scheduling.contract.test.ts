import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile IndexNow reconciliation scheduling", () => {
  it("runs only in production, stays non-blocking, and retries only changed graphs", () => {
    const indexNow = read("server/services/indexNowService.ts");
    const reconciliation = read("server/services/publicProfileIndexNowReconciliation.ts");

    expect(indexNow).toContain("schedulePublicProfileIndexNowReconciliation");
    expect(indexNow).toContain('process.env.NODE_ENV !== "production"');
    expect(indexNow).toContain("INDEXNOW_PROFILE_RECONCILIATION_DISABLED");
    expect(indexNow).toContain('import("./publicProfileIndexNowReconciliation")');
    expect(indexNow).toContain("timer.unref?.()");
    expect(indexNow).toContain("a later deploy will retry");

    expect(reconciliation).toContain("fingerprintPublicProfileIndexNowUrls");
    expect(reconciliation).toContain("data->>'fingerprint' = $2");
    expect(reconciliation).toContain("data->>'status' = 'submitted'");
    expect(reconciliation).toContain("INDEXNOW_BATCH_SIZE = 10_000");
    expect(reconciliation).toContain("shouldIndexPublicProfileSlug");
    expect(reconciliation).toContain("customDomain");
    expect(reconciliation).toContain("IndexNow is a change notification");
  });
});
