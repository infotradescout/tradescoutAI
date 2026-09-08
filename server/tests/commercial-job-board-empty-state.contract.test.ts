import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("commercial job board empty state", () => {
  it("names the navigation entry for the commercial jobs it opens", () => {
    const source = fs.readFileSync(
      path.join(root, "client/src/components/layout/AppShellCore.tsx"),
      "utf8"
    );

    expect(source).toContain('label: "Browse commercial work"');
    expect(source).toContain('href: "/commercial-directory"');
  });

  it("separates future-work verification from applying to a live project", () => {
    const source = fs.readFileSync(
      path.join(root, "client/src/pages/commercial-directory.tsx"),
      "utf8"
    );

    expect(source).toContain("!error && !hasLiveProjects");
    expect(source).toContain("No commercial jobs are open right now");
    expect(source).toContain("There is nothing to apply for or bid on.");
    expect(source).toContain("Complete verification now so your business is ready");
    expect(source).toContain("Submit for Review");
  });
});
