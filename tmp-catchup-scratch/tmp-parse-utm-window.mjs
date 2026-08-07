import fs from "fs";

const j = JSON.parse(
  fs.readFileSync(
    "C:/Users/flavo/.cursor/projects/d-AAATraderCorner-TradeScout-TradeScoutPro/agent-tools/9f7974da-6172-4922-b76a-860c53a734af.txt",
    "utf8",
  ),
);
const arr = j.logs || [];
const rows = arr.map((l) => {
  const labels = Object.fromEntries((l.labels || []).map((x) => [x.name, x.value]));
  const ua = (l.message.match(/userAgent="([^"]+)"/) || [])[1] || "";
  const ip = (l.message.match(/clientIP="([^"]+)"/) || [])[1] || "";
  return { ts: l.timestamp, path: labels.path, status: labels.statusCode, ua: ua.slice(0, 90), ip };
});
const target = rows.filter((r) => r.ip === "71.15.45.126" || /utm_source=chatgpt/i.test(r.path || ""));
console.log("target count", target.length);
for (const r of target) console.log(r.ts, r.status, r.path, r.ua);
console.log("---unique paths---");
for (const p of [...new Set(rows.map((r) => r.path))].slice(0, 50)) console.log(p);
