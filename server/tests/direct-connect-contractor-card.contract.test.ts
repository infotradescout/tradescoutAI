import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect contractor request card contract", () => {
  it("includes actionable request card fields for provider-side decisions", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("type DirectConnectInboxItem = {");
    expect(source).toContain("title: string;");
    expect(source).toContain("description: string;");
    expect(source).toContain("status: string;");
    expect(source).toContain("countyFips?: string | null;");
    expect(source).toContain("attachmentCount?: number | null;");
  });

  it("surfaces budget, location, urgency context, and locked contact messaging", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("budgetMin?: string | null;");
    expect(source).toContain("budgetMax?: string | null;");
    expect(source).toContain("formatCountyLabel(request.countyFips, request?.stateCode)");
    expect(source).toContain("Messaging unlocks after a pro engages.");
  });

  it("keeps provider actions for respond/fit flow without exposing direct contact by default", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("decision: payload.decision");
    expect(source).toContain("statusTone(status)");
    expect(source).toContain("contactUnlocked");
  });
});
