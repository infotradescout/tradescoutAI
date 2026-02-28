import { describe, expect, it } from "vitest";
import fs from "fs";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("Home Report Sharing Contracts", () => {
  it("adds thread-scoped endpoints (intent-gated context)", () => {
    const src = read("server/routes.ts");
    expect(src).toContain("/api/messages/threads/:threadId/home-report");
    expect(src).toContain("/api/messages/threads/:threadId/home-report/share");
  });

  it("keeps address sharing opt-in (default redacted)", () => {
    const src = read("server/routes.ts");
    // Ensure the response mapping gates street fields behind includeAddress.
    expect(src).toContain("const includeAddress = share.includeAddress === true");
    expect(src).toContain("...(includeAddress");
    expect(src).toContain("address1");
    expect(src).toContain("zipCode");
  });

  it("does not expose document object keys in shared report payload", () => {
    const src = read("server/routes.ts");
    const start = src.indexOf('"/api/messages/threads/:threadId/home-report"');
    expect(start).toBeGreaterThanOrEqual(0);
    const tail = src.slice(start);
    const end = tail.indexOf("/api/messages/threads/:threadId/messages");
    const block = end > 0 ? tail.slice(0, end) : tail;

    // The shared payload may include document names/types, but must not leak storage keys.
    expect(block).not.toContain("objectKey");
  });
});
