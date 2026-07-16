import fs from "fs";
import path from "path";

const distPath = path.resolve("dist", "index.js");

if (!fs.existsSync(distPath)) {
  console.error(`[verify-no-vite-in-dist] dist/index.js not found at ${distPath}. Did you run npm run build first?`);
  process.exit(1);
}

const contents = fs.readFileSync(distPath, "utf8");

const dangerousPatterns = [
  { label: "ESM import from vite", re: /\bfrom\s+["']vite["']/ },
  { label: "dynamic import of vite package", re: /\bimport\(\s*["']vite["']\s*\)/ },
  { label: "CommonJS require of vite package", re: /\brequire\(\s*["']vite["']\s*\)/ },
  { label: "bundled Vite package path", re: /node_modules[\\/]+vite[\\/]/ },
  { label: "bundled server/vite module", re: /server[\\/]+vite(?:\.ts|\.js)?/ },
  { label: "Vite config bundled into server output", re: /vite\.config/ },
];

const failures = dangerousPatterns.filter(({ re }) => re.test(contents));

if (failures.length > 0) {
  console.error("[verify-no-vite-in-dist] Found production-dangerous Vite references in dist/index.js. This indicates the prod bundle may depend on dev tooling:");
  for (const failure of failures) {
    console.error(` - ${failure.label}: ${failure.re}`);
  }
  process.exit(1);
}

console.log("[verify-no-vite-in-dist] OK: no production-dangerous Vite references detected in dist/index.js");
