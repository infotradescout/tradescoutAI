import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect contractor console contracts", () => {
  it("defines contractor routed request list/detail/respond/contact endpoints", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('"/api/direct-connect/contractor/requests"');
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id"');
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id/respond"');
    expect(source).toContain('"/api/direct-connect/contractor/requests/:id/request-contact"');
  });

  it("keeps contact gated and requires response before contact request", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain(
      "Submit an interested or need_more_info response before requesting contact."
    );
    expect(source).toContain('nextState: "contractor_requested"');
    expect(source).not.toContain("buy lead");
    expect(source).not.toContain("featured placement");
  });

  it("does not expose homeowner private contact in contractor detail payload", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("requesterContact");
  });

  it("renders a minimal contractor request console surface", () => {
    const source = read("client/src/pages/contractor-dashboard.tsx");
    expect(source).toContain("Routed local requests");
    expect(source).toContain("/api/direct-connect/contractor/requests");
    expect(source).toContain("Respond interested");
    expect(source).toContain("Need more info");
    expect(source).toContain("Request contact");
    expect(source).toContain("latestStatus");
  });
});
