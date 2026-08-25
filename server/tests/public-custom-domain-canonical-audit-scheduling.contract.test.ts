import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public custom-domain canonical audit scheduling", () => {
  it("runs the rate-aware audit once in production after page and feed audits", () => {
    const service = read("server/services/indexNowService.ts");

    expect(service).toContain("schedulePublicCustomDomainCanonicalAudit");
    expect(service).toContain("customDomainCanonicalAuditScheduled");
    expect(service).toContain('process.env.NODE_ENV !== "production"');
    expect(service).toContain("PUBLIC_CUSTOM_DOMAIN_CANONICAL_AUDIT_DISABLED");
    expect(service).toContain("PUBLIC_CUSTOM_DOMAIN_CANONICAL_AUDIT_DELAY_MS");
    expect(service).toContain('import("./publicCustomDomainCanonicalAuditV2")');
    expect(service).toContain("runPublicCustomDomainCanonicalAuditV2");
    expect(service).toContain("timer.unref?.()");
    expect(service).toContain("schedulePublicCustomDomainCanonicalAudit();");
  });

  it("requires direct permanent redirects without claiming Google canonical selection", () => {
    const audit = read("server/services/publicCustomDomainCanonicalAudit.ts");

    expect(audit).toContain('redirect: "manual"');
    expect(audit).toContain("permanentRedirect");
    expect(audit).toContain("redirectIsDirect");
    expect(audit).toContain("locationMatchesCanonical");
    expect(audit).toContain("locationHostMatchesCanonical");
    expect(audit).toContain('"production_verified" | "production_failed" | "unavailable"');
    expect(audit).toContain("It is not proof that Google has recrawled, selected the canonical");
    expect(audit).toContain("buildProfileSitemapUrls");
    expect(audit).toContain("SitemapRepository");
  });

  it("spaces requests and keeps persistent rate limits as unavailable evidence", () => {
    const audit = read("server/services/publicCustomDomainCanonicalAuditV2.ts");

    expect(audit).toContain("PUBLIC_CUSTOM_DOMAIN_CANONICAL_AUDIT_REQUEST_INTERVAL_MS");
    expect(audit).toContain("createThrottledCanonicalAuditFetch");
    expect(audit).toContain("status === 408 || status === 429 || status >= 500");
    expect(audit).toContain("requestIntervalMs");
    expect(audit).toContain("DEFAULT_CONCURRENCY = 2");
    expect(audit).toContain("allowing the base audit to record the target as unavailable");
  });
});
