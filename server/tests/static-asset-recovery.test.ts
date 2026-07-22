import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCurrentEntryStylesheet } from "../staticAssetRecovery";

const temporaryDirectories: string[] = [];

function buildFixture(): { root: string; currentStylesheet: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tradescout-assets-"));
  temporaryDirectories.push(root);
  const assets = path.join(root, "assets");
  fs.mkdirSync(assets);
  const currentStylesheet = path.join(assets, "index-current123.css");
  fs.writeFileSync(currentStylesheet, "body{color:white}");
  fs.writeFileSync(
    path.join(root, "index.html"),
    '<link rel="stylesheet" crossorigin href="/assets/index-current123.css">'
  );
  return { root, currentStylesheet };
}

afterEach(() => {
  while (temporaryDirectories.length) {
    fs.rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("stale entry stylesheet recovery", () => {
  it("maps a previous entry stylesheet hash to the current built stylesheet", () => {
    const fixture = buildFixture();
    expect(resolveCurrentEntryStylesheet(fixture.root, "/assets/index-previous456.css")).toBe(
      fixture.currentStylesheet
    );
  });

  it("does not substitute scripts, chunks, or unrelated files", () => {
    const fixture = buildFixture();
    expect(resolveCurrentEntryStylesheet(fixture.root, "/assets/index-old.js")).toBeNull();
    expect(resolveCurrentEntryStylesheet(fixture.root, "/assets/vendor-old.css")).toBeNull();
    expect(resolveCurrentEntryStylesheet(fixture.root, "/favicon.css")).toBeNull();
  });
});
