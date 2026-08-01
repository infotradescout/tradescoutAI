import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDistPath = path.join(repositoryRoot, "dist", "public");
const landingPath = path.join(publicDistPath, "landing.html");

function fail(message) {
  console.error(`[public-landing-bundle] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(landingPath)) fail("dist/public/landing.html is missing");

const html = fs.readFileSync(landingPath, "utf8");
const forbiddenStartupAssets = [
  "vendor-recharts",
  "vendor-jspdf",
  "vendor-html2canvas",
  "vendor-fabric",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

for (const forbidden of forbiddenStartupAssets) {
  if (html.includes(forbidden)) fail(`landing HTML still starts with ${forbidden}`);
}

const assetReferences = [...html.matchAll(/\b(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map(
  (match) => match[1]
);
const missingAssets = assetReferences.filter(
  (reference) => !fs.existsSync(path.join(publicDistPath, reference))
);
if (missingAssets.length > 0) fail(`landing references missing assets: ${missingAssets.join(", ")}`);

const startupBytes = assetReferences.reduce(
  (total, reference) => total + fs.statSync(path.join(publicDistPath, reference)).size,
  0
);
const maximumStartupBytes = 450_000;
if (startupBytes > maximumStartupBytes) {
  fail(`landing startup assets are ${startupBytes} bytes; budget is ${maximumStartupBytes}`);
}

console.log(
  `[public-landing-bundle] verified ${assetReferences.length} startup assets (${startupBytes} bytes)`
);
