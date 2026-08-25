import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile production audit scheduling", () => {
  it("runs once after production startup without depending on IndexNow availability", () => {
    const service = read("server/services/indexNowService.ts");

    expect(service).toContain("schedulePublicProfileProductionAudit");
    expect(service).toContain('process.env.NODE_ENV !== "production"');
    expect(service).toContain('PUBLIC_PROFILE_PRODUCTION_AUDIT_DISABLED');
    expect(service).toContain('PUBLIC_PROFILE_PRODUCTION_AUDIT_DELAY_MS');
    expect(service).toContain('import("./publicProfileProductionAudit")');
    expect(service).toContain("runPublicProfileProductionAudit()");
    expect(service).toContain("schedulePublicProfileIndexNowReconciliation();");
    expect(service).toContain("schedulePublicProfileProductionAudit();");
    expect(service).toContain("disabling notifications must never disable live");
  });

  it("keeps the audit non-blocking and retryable on a later deploy", () => {
    const service = read("server/services/indexNowService.ts");

    expect(service).toContain("const timer = setTimeout(() => {");
    expect(service).toContain("timer.unref?.()");
    expect(service).toContain("a later deploy will retry");
  });
});
