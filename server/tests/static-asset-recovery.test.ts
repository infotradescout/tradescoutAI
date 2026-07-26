import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveCanonicalDuplicatedAssetPath,
  resolveCurrentEntryStylesheet,
} from "../staticAssetRecovery";

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

describe("duplicated Vite asset prefix recovery", () => {
  it("canonicalizes an existing hashed build artifact", () => {
    const fixture = buildFixture();
    const scriptName = "insurance-verification-sbGIn5yd.js";
    fs.writeFileSync(path.join(fixture.root, "assets", scriptName), "export {}");

    expect(
      resolveCanonicalDuplicatedAssetPath(
        fixture.root,
        `/assets/assets/${scriptName}`
      )
    ).toBe(`/assets/${scriptName}`);
  });

  it("fails closed for missing, unhashed, nested, and traversal paths", () => {
    const fixture = buildFixture();
    fs.writeFileSync(path.join(fixture.root, "assets", "plain.js"), "export {}");

    expect(
      resolveCanonicalDuplicatedAssetPath(
        fixture.root,
        "/assets/assets/missing-AbCd1234.js"
      )
    ).toBeNull();
    expect(
      resolveCanonicalDuplicatedAssetPath(fixture.root, "/assets/assets/plain.js")
    ).toBeNull();
    expect(
      resolveCanonicalDuplicatedAssetPath(
        fixture.root,
        "/assets/assets/nested/chunk-AbCd1234.js"
      )
    ).toBeNull();
    expect(
      resolveCanonicalDuplicatedAssetPath(
        fixture.root,
        "/assets/assets/../chunk-AbCd1234.js"
      )
    ).toBeNull();
    fs.writeFileSync(
      path.join(fixture.root, "assets", "document-AbCd1234.html"),
      "<html></html>"
    );
    expect(
      resolveCanonicalDuplicatedAssetPath(
        fixture.root,
        "/assets/assets/document-AbCd1234.html"
      )
    ).toBeNull();
  });
});
