import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1k homeid evidence vault contracts", () => {
  it("adds HomeID evidence persistence endpoint and storage contract", () => {
    const homesSource = read("server/routes/homes.ts");
    expect(homesSource).toContain('router.put("/api/homeid/:homeId/evidence"');
    expect(homesSource).toContain(
      'const HOMEID_PERSISTENCE_EVIDENCE_TITLE = "homeid:persistence:evidence"'
    );
    expect(homesSource).toContain("evidence: z.array(homeIdEvidenceSchema).max(1200)");
  });

  it("includes evidence in HomeID persistence hydrate payload", () => {
    const homesSource = read("server/routes/homes.ts");
    expect(homesSource).toContain("evidenceRecord");
    expect(homesSource).toContain("evidence: HomeIdServerEvidence[]");
    expect(homesSource).toContain("evidence,");
  });

  it("adds completed-work evidence placeholders only from real request attachments", () => {
    const directConnectSource = read("server/routes/direct-connect/home-id.ts");
    expect(directConnectSource).toContain("async function upsertHomeIdEvidenceFromDirectConnect");
    expect(directConnectSource).toContain("title: HOMEID_PERSISTENCE_EVIDENCE_TITLE");
    expect(directConnectSource).toContain("rawAttachments");
    expect(directConnectSource).toContain("await upsertHomeIdEvidenceFromDirectConnect({");
    expect(directConnectSource).toContain('source: "direct_connect_completed_work"');
  });
});
