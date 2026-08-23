import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Community composer responsive containment", () => {
  const feed = read("client/src/pages/community-feed.tsx");
  const styles = read("client/src/index.css");

  it("allows the composer body and attachment strip to shrink while keeping submit visible", () => {
    expect(feed).toContain(
      '<div className="ts-community-composer__body min-w-0 flex-1 space-y-3">'
    );
    expect(feed).toContain('data-testid="community-post-composer"');
    expect(feed).toContain("overflow-x-clip");
    expect(feed).toContain(
      'className="ts-community-composer__attachments flex min-w-0 flex-1 flex-wrap gap-2"'
    );
    expect(feed).toMatch(/className="ts-community-submit-action[^"]*\bshrink-0\b/);

    expect(styles).toMatch(
      /\.ts-community-composer__actions \{[^}]*min-width:\s*0;[^}]*flex-direction:\s*row !important;/s
    );
    expect(styles).toMatch(
      /\.ts-community-composer__attachments \{[^}]*min-width:\s*0;[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;[^}]*overscroll-behavior-inline:\s*contain;/s
    );
    expect(styles).toMatch(
      /\.ts-community-composer__actions \.ts-community-submit-action \{[^}]*min-height:\s*44px !important;[^}]*width:\s*auto !important;[^}]*flex:\s*0 0 auto;/s
    );
  });

  it("keeps normal-height desktop stickiness but releases the composer in short viewports", () => {
    expect(feed).toContain("md:sticky md:top-2");
    expect(feed).not.toContain("md:sticky md:top-16");
    expect(styles).toMatch(
      /@media \(min-width: 768px\) and \(max-height: 480px\) \{\s*\.ts-community-composer \{[^}]*position:\s*static !important;[^}]*top:\s*auto !important;[^}]*scroll-margin-top:\s*5rem;/s
    );
    expect(styles).toMatch(
      /@media \(min-width: 768px\) and \(max-height: 480px\)[\s\S]*?\.ts-community-composer__input \{[^}]*scroll-margin-top:\s*5rem;/
    );
  });
});
