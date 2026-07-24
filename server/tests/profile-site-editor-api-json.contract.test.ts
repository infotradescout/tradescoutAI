import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const editor = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/ProfileSiteEditor.tsx"),
  "utf8"
);
const queryClient = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/lib/queryClient.ts"),
  "utf8"
);

describe("ProfileSiteEditor apiRequest JSON contract", () => {
  it("documents that apiRequest returns already-parsed JSON, not a Fetch Response", () => {
    expect(queryClient).toContain("return JSON.parse(text)");
    expect(queryClient).toMatch(/export async function apiRequest\([\s\S]*?Promise<any>/);
  });

  it("loads and mutates profiles without calling .json() on apiRequest results", () => {
    // Regression: awaiting apiRequest then calling .json() throws
    // "TypeError: ...json is not a function" because the helper already parsed the body.
    expect(editor).toContain('await apiRequest("GET", "/api/profiles")');
    expect(editor).toContain("`/api/profiles/${found.id}`");
    expect(editor).not.toMatch(/\.json\s*\(/);
    expect(editor).toContain("apiRequest already returns parsed JSON");
  });
});
