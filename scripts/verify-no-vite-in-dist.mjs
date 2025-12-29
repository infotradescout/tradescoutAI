import fs from "fs";
import path from "path";

const distPath = path.resolve("dist", "index.js");

if (!fs.existsSync(distPath)) {
  console.error(`[verify-no-vite-in-dist] dist/index.js not found at ${distPath}. Did you run npm run build first?`);
  process.exit(1);
}

const contents = fs.readFileSync(distPath, "utf8");

const patterns = [
  /\bfrom \"vite\"/,
  /\bfrom 'vite'/,
  /vite\.config/,
  /server\/vite/,
];

const failures = patterns.filter((re) => re.test(contents));

if (failures.length > 0) {
  console.error("[verify-no-vite-in-dist] Found Vite-related references in dist/index.js. This indicates the prod bundle is depending on dev tooling. Patterns:");
  for (const re of failures) {
    console.error(` - ${re}`);
  }
  process.exit(1);
}

console.log("[verify-no-vite-in-dist] OK: no Vite references detected in dist/index.js");
