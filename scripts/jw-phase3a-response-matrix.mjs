/**
 * Production-like local response matrix for JW /jw-stone across 4 UAs.
 * Usage: node scripts/jw-phase3a-response-matrix.mjs [baseUrl]
 */
import http from "node:http";

const baseUrl = String(process.argv[2] || "http://127.0.0.1:5000").replace(/\/+$/, "");
const path = "/jw-stone";

const UAS = [
  [
    "browser",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  ],
  [
    "OAI-SearchBot",
    "Mozilla/5.0 AppleWebKit/537.36 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
  ],
  ["GPTBot", "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2; +https://openai.com/gptbot)"],
  [
    "ChatGPT-User",
    "Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
  ],
];

function fetchHtml(ua) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      { method: "GET", headers: { "User-Agent": ua, Accept: "text/html" } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function facts(html) {
  const canonical =
    html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i)?.[1] || null;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || null;
  const jsonLdRaw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1];
  let jsonLd = null;
  try {
    jsonLd = jsonLdRaw ? JSON.parse(jsonLdRaw) : null;
  } catch {
    jsonLd = null;
  }
  return {
    canonical,
    h1,
    hasMarker: /data-seo-jw-stone-marketplace/i.test(html),
    hasBusiness: /JW Stone/i.test(html),
    hasInventory: /Current Inventory|stone collection/i.test(html),
    hasContact: /ask JW Stone|ask about a material/i.test(html),
    emptyRootOnly:
      /<div id="root">\s*<\/div>/i.test(html) && !/data-seo-jw-stone-marketplace/i.test(html),
    jsonLdType: jsonLd?.["@type"] || null,
    jsonLdName: jsonLd?.name || null,
    jsonLdUrl: jsonLd?.url || null,
  };
}

const rows = [];
for (const [label, ua] of UAS) {
  const res = await fetchHtml(ua);
  const f = facts(res.body);
  rows.push({ label, status: res.status, ...f, bytes: res.body.length });
  console.log(
    JSON.stringify(
      {
        label,
        status: res.status,
        ...f,
        bytes: res.body.length,
      },
      null,
      2
    )
  );
}

const base = rows[0];
let ok = true;
for (const row of rows) {
  if (row.status !== 200) ok = false;
  if (row.canonical !== base.canonical) ok = false;
  if (row.h1 !== base.h1) ok = false;
  if (!row.hasMarker || !row.hasBusiness || !row.hasInventory || !row.hasContact) ok = false;
  if (row.emptyRootOnly) ok = false;
  if (row.jsonLdType !== base.jsonLdType || row.jsonLdName !== base.jsonLdName) ok = false;
}

if (!ok) {
  console.error("PHASE3A_MATRIX_FAIL");
  process.exit(1);
}
console.log("PHASE3A_MATRIX_PASS");
