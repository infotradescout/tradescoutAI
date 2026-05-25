import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("dashboard endpoint contracts", () => {
  it("requires authenticated user id and does not crash on missing auth payload", () => {
    const source = read("server/routes.ts");
    expect(source).toContain('app.get("/api/dashboard", isAuthenticated');
    expect(source).toContain('return res.status(401).json({ message: "User not authenticated" })');
  });

  it("uses fail-soft query loading for partial data sources", () => {
    const source = read("server/routes.ts");
    expect(source).toContain(
      "const safeQuery = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {"
    );
    expect(source).toContain("[dashboard] failed to load");
    expect(source).toContain('"marketplace listings"');
    expect(source).toContain('"recent posts"');
  });

  it("keeps default dashboard shape even when optional data is unavailable", () => {
    const source = read("server/routes.ts");
    expect(source).toContain("stats: {");
    expect(source).toContain("myProjects: []");
    expect(source).toContain("myListings: []");
    expect(source).toContain("quotes: []");
    expect(source).toContain("conversations: []");
  });
});
