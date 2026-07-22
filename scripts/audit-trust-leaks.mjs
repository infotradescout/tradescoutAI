import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["client/src/pages", "client/src/components"];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

// Keep this focused on user-facing trust-leak copy, not implementation comments.
const blockedPhrases = [/coming soon/i, /work in progress/i, /not implemented/i, /unimplemented/i];

// "Coming soon" is allowed only when the product names the exact unfinished
// capability and gives the user a useful alternative. Everything else remains
// blocked so vague stubs cannot spread across customer-facing surfaces.
const approvedComingSoonCopy = new Map([
  ["client/src/components/community/CommunityCTA.tsx", ["More ways to connect are coming soon"]],
  [
    "client/src/components/community/CommunityComposerInline.tsx",
    ["Video posts are coming soon", "Mood updates are coming soon"],
  ],
  [
    "client/src/components/profile/PublicProfileProductCard.tsx",
    ["Photo coming soon"],
  ],
  [
    "client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx",
    ["Calling is coming soon"],
  ],
]);

const lineIgnorePatterns = [
  /placeholder/i,
  /data-\[placeholder\]/i,
  /::placeholder/i,
  /placeholder:/i,
  /\/\/\s*/i,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, out);
      continue;
    }
    if (allowedExtensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function hasQuotedString(text) {
  return /["'`].*["'`]/.test(text);
}

function isApprovedComingSoonCopy(relPath, line) {
  const approved = approvedComingSoonCopy.get(relPath) ?? [];
  return approved.some(
    (copy) =>
      line.includes(`"${copy}"`) ||
      line.includes(`'${copy}'`) ||
      line.includes(`\`${copy}\``) ||
      line.includes(`>${copy}<`)
  );
}

const failures = [];

for (const relRoot of scanRoots) {
  const fullRoot = path.join(root, relRoot);
  const files = walk(fullRoot);
  for (const filePath of files) {
    const relPath = path.relative(root, filePath).replaceAll("\\", "/");
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (!hasQuotedString(line)) return;
      if (lineIgnorePatterns.some((p) => p.test(line))) return;
      for (const phrase of blockedPhrases) {
        if (phrase.test(line)) {
          if (/coming soon/i.test(line) && isApprovedComingSoonCopy(relPath, line)) return;
          failures.push(`${relPath}:${idx + 1}: ${line.trim()}`);
          break;
        }
      }
    });
  }
}

if (failures.length > 0) {
  console.error("[trust-leaks] blocking findings:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("[trust-leaks] pass (no blocked user-facing phrases found)");
