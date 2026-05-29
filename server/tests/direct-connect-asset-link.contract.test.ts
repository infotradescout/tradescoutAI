import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("direct connect asset link contracts", () => {
  it("accepts optional HomeID/component fields on request create", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("homeId: z.string().trim().min(1).max(120).optional()");
    expect(source).toContain("assetComponentId: z.string().trim().min(1).max(120).optional()");
    expect(source).toContain("assetComponentType: z");
    expect(source).toContain("homeContextIntent: z");
  });

  it("records asset link metadata as a request event", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain('type: "asset_linked"');
    expect(source).toContain("metadata: { assetLink }");
    expect(source).toContain('source: "direct_connect_request"');
  });
});
