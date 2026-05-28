import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("admin audit log UI controls contracts", () => {
  it("uses audit-log query params from filter controls", () => {
    const source = read("client/src/pages/admin-audit-log.tsx");

    expect(source).toContain('params.set("limit", appliedFilter.limit)');
    expect(source).toContain('params.set("sort", appliedFilter.sort)');
    expect(source).toContain('params.set("action", appliedFilter.action.trim())');
    expect(source).toContain('params.set("actorId", appliedFilter.actorId.trim())');
    expect(source).toContain('params.set("from", new Date(appliedFilter.from).toISOString())');
    expect(source).toContain('params.set("to", new Date(appliedFilter.to).toISOString())');
  });

  it("exposes filter controls and reset/apply affordances", () => {
    const source = read("client/src/pages/admin-audit-log.tsx");

    expect(source).toContain('<Label htmlFor="audit-limit">Limit</Label>');
    expect(source).toContain('<SelectItem value="200">200</SelectItem>');
    expect(source).toContain('<Label htmlFor="audit-sort">Sort</Label>');
    expect(source).toContain('<SelectItem value="desc">Newest first</SelectItem>');
    expect(source).toContain('<Label htmlFor="audit-action">Action</Label>');
    expect(source).toContain('<Label htmlFor="audit-actor">Actor/Admin ID</Label>');
    expect(source).toContain('<Label htmlFor="audit-from">From</Label>');
    expect(source).toContain('<Label htmlFor="audit-to">To</Label>');
    expect(source).toContain("Apply");
    expect(source).toContain("Reset");
  });

  it("keeps response contract and auth-check flow", () => {
    const source = read("client/src/pages/admin-audit-log.tsx");

    expect(source).toContain('const healthRes = await fetch("/api/admin/health"');
    expect(source).toContain("setAllowed(true)");
    expect(source).toContain("setLog(Array.isArray(data?.log) ? data.log : [])");
  });
});
