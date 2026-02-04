import fs from "node:fs";
import path from "node:path";

function replaceAll(content, replacements) {
  let updated = content;
  let changed = false;
  const stats = [];

  for (const { from, to, label } of replacements) {
    const before = updated;
    updated = updated.split(from).join(to);
    const count = before === updated ? 0 : (before.length - updated.length) / (from.length - to.length) || 1;
    // The count formula above is unreliable when strings differ in length;
    // compute count via a simple scan.
    let occurrences = 0;
    let idx = 0;
    while (true) {
      const at = before.indexOf(from, idx);
      if (at === -1) break;
      occurrences += 1;
      idx = at + from.length;
    }
    if (occurrences > 0) {
      changed = true;
      stats.push({ label: label ?? from, occurrences });
    }
  }

  return { updated, changed, stats };
}

function patchFile(relPath, replacements) {
  const filePath = path.resolve(process.cwd(), relPath);
  const original = fs.readFileSync(filePath, "utf8");
  const { updated, changed, stats } = replaceAll(original, replacements);
  if (!changed) return { file: relPath, changed: false, stats: [] };
  fs.writeFileSync(filePath, updated, "utf8");
  return { file: relPath, changed: true, stats };
}

const replacements = [
  { from: "(req: any, res: any)", to: "(req: Request, res: Response)" },
  { from: "(req: any, res: any,", to: "(req: Request, res: Response," },
];

const results = [
  patchFile("server/routes.ts", replacements),
  patchFile("server/routes/admin.ts", replacements),
];

for (const r of results) {
  if (!r.changed) continue;
  const summary = r.stats.map((s) => `${s.label}: ${s.occurrences}`).join(", ");
  console.log(`[codemod] ${r.file}: ${summary}`);
}
