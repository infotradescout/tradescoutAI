import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const packageJson = JSON.parse(read("package.json"));
const runtimePackage = JSON.parse(read("runtime/package.json"));
const capacitorPackages = Object.freeze({
  "@capacitor/android": "^7.4.3",
  "@capacitor/core": "^7.4.3",
  "@capacitor/ios": "^7.4.3",
});

test("Capacitor platform packages remain pinned to the mobile build lane", () => {
  for (const [name, version] of Object.entries(capacitorPackages)) {
    assert.equal(packageJson.dependencies?.[name], undefined, `${name} must not be a server production dependency`);
    assert.equal(packageJson.devDependencies?.[name], version, `${name} mobile-build version drifted`);
    assert.equal(runtimePackage.dependencies?.[name], undefined, `${name} entered the isolated server runtime`);
  }
  assert.equal(packageJson.devDependencies?.["@capacitor/cli"], "^7.4.3");
});

test("mobile commands, config, and checked-in native projects retain ownership", () => {
  assert.equal(packageJson.scripts?.["mobile:web"], "npm run build");
  assert.equal(packageJson.scripts?.["mobile:sync"], "npm run mobile:web && npx cap sync");
  assert.equal(packageJson.scripts?.["mobile:open:android"], "npx cap open android");
  assert.equal(packageJson.scripts?.["mobile:open:ios"], "npx cap open ios");

  const config = read("capacitor.config.ts");
  assert.match(config, /appId:\s*["']com\.thetradescout\.app["']/);
  assert.match(config, /webDir:\s*["']dist\/public["']/);
  assert.match(config, /bundledWebRuntime:\s*false/);
  assert.equal(fs.existsSync(path.join(root, "android/app/src/main/java/com/thetradescout/app/MainActivity.java")), true);
  assert.equal(fs.existsSync(path.join(root, "android/capacitor.settings.gradle")), true);
  assert.equal(fs.existsSync(path.join(root, "ios/App/App/AppDelegate.swift")), true);
  assert.equal(fs.existsSync(path.join(root, "ios/App/Podfile")), true);
});

test("web and server sources do not create an unresolved Capacitor runtime edge", () => {
  const sourceRoots = ["client/src", "server", "shared", "agent-runtime"];
  const extensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);
  const violations = [];
  for (const sourceRoot of sourceRoots) {
    const absoluteRoot = path.join(root, sourceRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    const pending = [absoluteRoot];
    while (pending.length) {
      const directory = pending.pop();
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) pending.push(absolute);
        else if (extensions.has(path.extname(entry.name)) && /["']@capacitor\//.test(fs.readFileSync(absolute, "utf8"))) {
          violations.push(path.relative(root, absolute));
        }
      }
    }
  }
  assert.deepEqual(violations, []);

  if (fs.existsSync(path.join(root, "dist/index.js"))) {
    const serverBundle = read("dist/index.js");
    assert.doesNotMatch(serverBundle, /@capacitor\/(?:android|core|ios)/);
  }
  if (fs.existsSync(path.join(root, "dist/public/assets"))) {
    const assets = fs.readdirSync(path.join(root, "dist/public/assets")).filter((file) => file.endsWith(".js"));
    const builtJavaScript = assets.map((file) => read(path.join("dist/public/assets", file))).join("\n");
    assert.doesNotMatch(builtJavaScript, /@capacitor\/(?:android|core|ios)/);
  }
});
