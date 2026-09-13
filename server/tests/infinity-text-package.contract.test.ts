import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const packageName = "@tradescout-infinity/contracts";
const textImport = `${packageName}/text`;
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");
const readJson = (relative: string) => JSON.parse(read(relative));
const digest = (bytes: Buffer, algorithm = "sha256") =>
  createHash(algorithm).update(bytes).digest("hex");

describe("Infinity text package distribution", () => {
  it("pins the dependency and installed module to the recorded canonical package", () => {
    const provenance = readJson("vendor/infinity/provenance.json");
    const manifest = readJson("package.json");
    const lock = readJson("package-lock.json");
    const archivePath = `vendor/infinity/${provenance.package.archive}`;
    const archive = readFileSync(path.join(root, archivePath));
    const integrity = `sha512-${createHash("sha512").update(archive).digest("base64")}`;

    expect(provenance.package.name).toBe(packageName);
    expect(manifest.dependencies[packageName]).toBe(`file:${archivePath}`);
    expect(lock.packages[""].dependencies[packageName]).toBe(`file:${archivePath}`);
    expect(digest(archive)).toBe(provenance.package.sha256);
    expect(integrity).toBe(provenance.package.integrity);
    expect(lock.packages[`node_modules/${packageName}`].integrity).toBe(integrity);
    expect(lock.packages[`node_modules/${packageName}`].version).toBe(provenance.package.version);

    const require = createRequire(path.join(root, "package.json"));
    const installedModule = require.resolve(textImport);
    expect(installedModule.replaceAll("\\", "/")).toMatch(
      /@tradescout-infinity\/contracts\/dist\/src\/text\.js$/
    );
    expect(digest(readFileSync(installedModule))).toBe(provenance.source.compiledModuleSha256);
    expect(digest(readFileSync(installedModule.replace(/\.js$/, ".d.ts")))).toBe(
      provenance.source.declarationSha256
    );
    expect(provenance.consumer.path).toBe("shared/communityPostShare.ts");
    expect(provenance.consumer.import).toBe(textImport);
  });

  it("bundles every recorded caller through the browser-safe text export", async () => {
    const { consumer } = readJson("vendor/infinity/provenance.json");
    const callers = [consumer.path, ...consumer.additionalPaths];
    expect(new Set(callers).size).toBe(11);
    const result = await build({
      absWorkingDir: root,
      entryPoints: callers,
      outdir: path.join(root, "tmp/infinity-text-bundle"),
      bundle: true,
      platform: "browser",
      format: "esm",
      write: false,
      metafile: true,
      logLevel: "silent",
    });
    const inputs = Object.keys(result.metafile!.inputs).map((input) => input.replaceAll("\\", "/"));
    for (const caller of callers) expect(inputs).toContain(caller);
    expect(
      inputs.some((input) => /@tradescout-infinity\/contracts\/dist\/src\/text\.js$/.test(input))
    ).toBe(true);
    expect(
      inputs.some((input) =>
        /@tradescout-infinity\/contracts\/dist\/src\/(?:index|sharedPrimitives)\.js$/.test(input)
      )
    ).toBe(false);
    const imports = Object.values(result.metafile!.outputs).flatMap((output) => output.imports);
    expect(imports.some((entry) => entry.path === "node:crypto" || entry.path === "crypto")).toBe(
      false
    );
    expect(result.outputFiles).toHaveLength(callers.length);
    for (const output of Object.values(result.metafile!.outputs)) {
      expect(
        Object.keys(output.inputs).some((input) =>
          /@tradescout-infinity\/contracts\/dist\/src\/text\.js$/.test(input.replaceAll("\\", "/"))
        )
      ).toBe(true);
    }
    for (const file of result.outputFiles!) expect(file.text).not.toContain("node:crypto");
  });

  it("makes the pinned archive available to Docker dependency installation and split workspaces", async () => {
    const instructions = read("Dockerfile")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    const install = instructions.findIndex((line) => /^RUN\s+npm\s+ci\b/.test(line));
    const archiveCopy = instructions.findIndex(
      (line) => /^COPY\s/.test(line) && line.includes("vendor/infinity")
    );
    expect(install).toBeGreaterThanOrEqual(0);
    expect(archiveCopy).toBeGreaterThanOrEqual(0);
    expect(archiveCopy).toBeLessThan(install);
    expect(instructions.slice(archiveCopy + 1, install).some((line) => /^FROM\s/.test(line))).toBe(
      false
    );

    const split = await import(
      pathToFileURL(path.join(root, "scripts/split-workspaces.config.mjs")).href
    );
    expect(split.frontendItems).toContain("vendor/infinity");
    expect(split.backendItems).toContain("vendor/infinity");
  });
});
