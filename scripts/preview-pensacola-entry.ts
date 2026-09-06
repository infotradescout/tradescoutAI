import fs from "node:fs";
import path from "node:path";
import { buildPublicPensacolaHtml } from "../server/publicLandingHtml";

const outputPath = process.argv[2];
if (!outputPath) throw new Error("A preview output path is required");
const builtTemplate = fs.readFileSync("dist/public/index.html", "utf8");
const stylesheets = Array.from(builtTemplate.matchAll(/<link\b[^>]*href="([^\"]+\.css)"[^>]*>/g));
if (!stylesheets.length) throw new Error("Built stylesheet missing");
const css = stylesheets
  .map((match) => fs.readFileSync(path.join("dist/public", match[1]), "utf8"))
  .join("\n");
const template = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pensacola preview</title><style>${css}</style></head><body style="background:#0f172a"><div id="root"></div></body></html>`;
const rendered = buildPublicPensacolaHtml({
  origin: "https://www.thetradescout.com",
  templateHtml: template,
});
// The preview keeps the real page body. Absolute destinations make its links usable outside the site.
const preview = rendered.replace(/(href|src)="\/(?!\/)/g, '$1="https://www.thetradescout.com/');
fs.writeFileSync(outputPath, preview);
console.log(
  JSON.stringify({ outputPath, bytes: Buffer.byteLength(preview), stylesheets: stylesheets.length })
);
