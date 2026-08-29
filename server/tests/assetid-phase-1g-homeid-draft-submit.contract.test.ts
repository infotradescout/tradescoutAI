import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1g homeid draft submit contracts", () => {
  it("exposes submit endpoint for HomeID-generated Direct Connect drafts", () => {
    const route = read("server/routes/direct-connect.ts");
    const authority = read("server/services/homeIdPacketAuthority.ts");
    expect(route).toContain('"/api/direct-connect/requests/:id/submit-homeid-draft"');
    expect(route).toContain("await submitHomeIdPacketDraft({");
    expect(authority).toContain('type: "homeid_draft_reviewed"');
    expect(authority).toContain('type: "homeid_draft_submitted"');
  });

  it("keeps lifecycle events and the live transition in one fail-closed transaction", () => {
    const source = read("server/services/homeIdPacketAuthority.ts");
    const workflow = source.indexOf(
      "export async function submitHomeIdPacketDraftWithTransaction("
    );
    const wrapper = source.indexOf("export async function submitHomeIdPacketDraft(");
    const transaction = source.indexOf("db.transaction", wrapper);
    const reviewed = source.indexOf('type: "homeid_draft_reviewed"', workflow);
    const submitted = source.indexOf('type: "homeid_draft_submitted"', workflow);
    const transition = source.indexOf("transitionDraftToOpen({", workflow);
    const timeline = source.indexOf("insertSubmissionTimelineRecord({", transition);
    expect(transaction).toBeGreaterThan(wrapper);
    expect(reviewed).toBeGreaterThan(workflow);
    expect(submitted).toBeGreaterThan(reviewed);
    expect(transition).toBeGreaterThan(submitted);
    expect(timeline).toBeGreaterThan(transition);
    expect(source).toContain('scope: "community"');
    expect(source).toContain('visibility: "community"');
    expect(source.slice(workflow)).not.toContain("Failed to record homeid draft submit events");
  });

  it("shows explicit draft review and submit UI in Homes flow", () => {
    const source = read("client/src/pages/homeid/HomeIdWorkspace.tsx");
    expect(source).toContain("Resume Direct Connect draft · Review and submit");
    expect(source).toContain("Submit Direct Connect request");
    expect(source).toContain("/submit-homeid-draft");
  });
});
