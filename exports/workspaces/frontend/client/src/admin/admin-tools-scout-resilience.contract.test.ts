import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("admin tools scout resilience wiring", () => {
  it("registers Scout Resilience admin tool route", () => {
    const source = read("client/src/admin/adminTools.tsx");
    expect(source).toContain('id: "scout-resilience"');
    expect(source).toContain('path: "/admin/scout-resilience"');
    expect(source).toContain("AdminScoutResilience");
  });
});
