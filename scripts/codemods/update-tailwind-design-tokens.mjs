import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const TARGET_DIRS = [
  path.join(repoRoot, "client", "src", "components"),
  path.join(repoRoot, "client", "src", "pages"),
];

const EXCLUDE_PATH_SEGMENTS = [
  `${path.sep}client${path.sep}src${path.sep}pages${path.sep}admin${path.sep}`,
];

function isTargetFile(p) {
  const norm = p.split(path.sep).join(path.sep);
  if (!norm.endsWith(".ts") && !norm.endsWith(".tsx")) return false;
  for (const seg of EXCLUDE_PATH_SEGMENTS) {
    if (norm.includes(seg)) return false;
  }
  return true;
}

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** Ordered replacements (regex, replacement). */
const REPLACERS = [
  // Custom deprecated tokens -> new system
  [/\bbg-tsSurface\b/g, "bg-tsCard"],
  [/\bbg-tsBorder(?:\/\d+)?\b/g, "bg-white/10"],
  [/\bborder-tsBorder\b/g, "border-white/10"],
  [/\bborder-tsBorderMuted\b/g, "border-white/10"],
  [/\btsBorder\b/g, "white/10"],
  [/\btext-tsTextMain\b/g, "text-white"],
  [/\btext-tsTextSecondary\b/g, "text-white/70"],
  [/\btext-tsTextMuted\b/g, "text-white/60"],
  [/\bbg-tsTextMuted(?:\/\d+)?\b/g, "bg-white/5"],
  [/\bbg-tsCardMuted\b/g, "bg-white/5"],

  // Accent mapping
  [/\btext-tsAccentSoft\b/g, "text-ts-orange"],
  [/\btext-tsAccent\b/g, "text-ts-orange"],
  [/\btext-tsAccentSecondary\b/g, "text-ts-orange"],
  [/\bbg-tsAccentSoft\b/g, "bg-ts-orange/20"],
  [/\bbg-tsAccent\b/g, "bg-ts-orange"],
  [/\bbg-tsAccentSecondary\b/g, "bg-ts-orange"],
  [/\bborder-tsAccent\b/g, "border-ts-orange"],
  [/\bborder-tsAccentSecondary(?:\/\d+)?\b/g, "border-ts-orange/30"],
  [/\bring-tsAccent\b/g, "ring-ts-orange/70"],
  [/\bfocus-visible:ring-tsAccent\b/g, "focus-visible:ring-ts-orange/70"],
  [/\bfrom-tsAccentSecondary\b/g, "from-ts-orange"],
  [/\bto-tsAccentSecondary\b/g, "to-ts-orange"],
  [/\bvia-tsAccentSecondary\b/g, "via-ts-orange"],
  [/\bfrom-tsAccent\b/g, "from-ts-orange"],
  [/\bto-tsAccent\b/g, "to-ts-orange"],
  [/\bvia-tsAccent\b/g, "via-ts-orange"],
  [/\bfrom-tsAccentSoft\b/g, "from-ts-orange"],
  [/\bto-tsAccentSoft\b/g, "to-ts-orange"],
  [/\bvia-tsAccentSoft\b/g, "via-ts-orange"],

  // On-accent text
  [/\btsOnAccent\b/g, "text-black"],

  // Error mapping
  [/\btext-tsError\b/g, "text-red-500"],
  [/\bbg-tsError\b/g, "bg-red-500"],
  [/\bborder-tsError\b/g, "border-red-500"],

  // Orange -> ts-orange (including hover/focus variants)
  [/\btext-orange-(?:50|100|200|300|400|500|600|700|800|900)\b/g, "text-ts-orange"],
  [/\bbg-orange-(?:50|100|200)\b/g, "bg-ts-orange/10"],
  [/\bdark:bg-orange-(?:950|900)(?:\/\d+)?\b/g, "dark:bg-ts-orange/10"],
  [/\bbg-orange-(?:950|900)(?:\/\d+)?\b/g, "bg-ts-orange/10"],
  [/\bbg-orange-(?:300|400)\b/g, "bg-ts-orange"],
  [/\bbg-orange-500\b/g, "bg-ts-orange"],
  [/\bbg-orange-600\b/g, "bg-ts-orange-dark"],
  [/\bhover:bg-orange-700\b/g, "hover:bg-ts-orange-dark"],
  [/\bhover:bg-orange-600\b/g, "hover:bg-ts-orange-dark"],
  [/\bhover:bg-orange-500\b/g, "hover:bg-ts-orange-dark"],
  [/\bhover:bg-orange-400\b/g, "hover:bg-ts-orange-dark"],
  [/\bborder-orange-(?:50|100|200|300|400|500|600|700|800|900)(?:\/\d+)?\b/g, "border-ts-orange/30"],
  [/\bfocus-visible:border-orange-(?:50|100|200|300|400|500|600|700|800|900)\b/g, "focus-visible:border-ts-orange"],
  [/\bfocus-visible:ring-orange-(?:50|100|200|300|400|500|600|700|800|900)(?:\/\d+)?\b/g, "focus-visible:ring-ts-orange/70"],
  [/\bring-orange-(?:50|100|200|300|400|500|600|700|800|900)(?:\/\d+)?\b/g, "ring-ts-orange/70"],

  // Navy -> new system
  [/\bbg-navy-(?:950|900)\b/g, "bg-tsBg"],
  [/\bbg-navy-(?:800|700|600)\b/g, "bg-tsCard"],
  [/\bbg-navy-500\b/g, "bg-white/10"],
  [/\bborder-navy-(?:900|800|700|600)\b/g, "border-white/10"],
  [/\bborder-navy-500\b/g, "border-white/10"],
  [/\bborder-navy-400\b/g, "border-white/15"],
  [/\btext-navy-(?:950|900)\b/g, "text-black"],

  // Slate backgrounds
  [/\bbg-slate-950\/\d+\b/g, "bg-black/30"],
  [/\bbg-slate-950\b/g, "bg-tsBg"],
  [/\bbg-slate-900\/\d+\b/g, "bg-tsCard/95"],
  [/\bbg-slate-900\b/g, "bg-tsCard"],
  [/\bbg-slate-800\b/g, "bg-white/5"],
  [/\bbg-slate-700\b/g, "bg-white/10"],
  [/\bbg-slate-600\b/g, "bg-white/10"],
  [/\bbg-slate-500\b/g, "bg-white/10"],
  [/\bbg-slate-(?:50|100)\b/g, "bg-white/5"],
  [/\bbg-slate-200\b/g, "bg-white/10"],

  // Slate borders
  [/\bborder-slate-(?:950|900|800|700)\b/g, "border-white/10"],
  [/\bborder-slate-600\b/g, "border-white/15"],
  [/\bborder-slate-500\b/g, "border-white/15"],
  [/\bborder-slate-(?:50|100|200|300)\b/g, "border-white/10"],
  [/\bborder-slate-400(?:\/\d+)?\b/g, "border-white/15"],
  [/\bfocus:ring-slate-(?:950|900)\b/g, "focus:ring-ts-orange/70"],
  [/\bring-slate-(?:950|900)\b/g, "ring-ts-orange/70"],

  // Slate text
  [/\btext-slate-(?:50|100)\b/g, "text-white"],
  [/\btext-slate-(?:200|300)\b/g, "text-white/70"],
  [/\btext-slate-(?:400|500|600)\b/g, "text-white/60"],
  [/\btext-slate-(?:700|800|900)\b/g, "text-white/70"],
  [/\btext-slate-950\b/g, "text-black"],

  // Gray backgrounds/borders/text
  [/\bbg-gray-950\/\d+\b/g, "bg-black/30"],
  [/\bbg-gray-50\b/g, "bg-white/5"],
  [/\bbg-gray-100\b/g, "bg-white/5"],
  [/\bbg-gray-200\b/g, "bg-white/10"],
  [/\bbg-gray-300\b/g, "bg-white/10"],
  [/\bbg-gray-400\b/g, "bg-white/10"],
  [/\bbg-gray-500\b/g, "bg-white/10"],
  [/\bbg-gray-900\b/g, "bg-tsCard"],
  [/\bbg-gray-800\b/g, "bg-white/5"],
  [/\bbg-gray-700\b/g, "bg-white/10"],
  [/\bbg-gray-600\b/g, "bg-white/10"],
  [/\bborder-gray-(?:950|900|800|700)\b/g, "border-white/10"],
  [/\bborder-gray-200\b/g, "border-white/10"],
  [/\bborder-gray-300\b/g, "border-white/10"],
  [/\bborder-gray-(?:50|100)\b/g, "border-white/10"],
  [/\bborder-gray-400(?:\/\d+)?\b/g, "border-white/15"],
  [/\bborder-gray-500(?:\/\d+)?\b/g, "border-white/15"],
  [/\bborder-gray-600\b/g, "border-white/15"],
  [/\btext-gray-(?:50|100)\b/g, "text-white"],
  [/\btext-gray-(?:200|300)\b/g, "text-white/70"],
  [/\btext-gray-(?:400|500|600)\b/g, "text-white/60"],
  [/\btext-gray-(?:700|800)\b/g, "text-white/70"],
  [/\btext-gray-900\b/g, "text-white"],

  // Old app tokens that remain in some files
  [/\bbg-tsBg\b/g, "bg-tsBg"],
  [/\bbg-tsCard\b/g, "bg-tsCard"],
];

function applyReplacements(text) {
  let out = text;
  for (const [re, rep] of REPLACERS) {
    out = out.replace(re, rep);
  }

  // Fix invalid "double opacity" classes introduced historically or via replacements,
  // e.g. "bg-white/5/50" -> "bg-white/5". Tailwind only supports a single "/NN".
  out = out.replace(/bg-white\/5\/\d+/g, "bg-white/5");
  out = out.replace(/bg-white\/10\/\d+/g, "bg-white/10");
  out = out.replace(/border-white\/10\/\d+/g, "border-white/10");
  out = out.replace(/border-white\/15\/\d+/g, "border-white/15");
  out = out.replace(/text-white\/60\/\d+/g, "text-white/60");
  out = out.replace(/text-white\/70\/\d+/g, "text-white/70");

  // Normalize common input patterns to the new system (best-effort).
  out = out.replace(/\bbg-black\/30\s+border-white\/10\b/g, "bg-black/30 border-white/10");
  return out;
}

function main() {
  const files = TARGET_DIRS.flatMap((d) => walk(d)).filter(isTargetFile);
  let changed = 0;

  for (const file of files) {
    const before = fs.readFileSync(file, "utf8");
    const after = applyReplacements(before);
    if (after !== before) {
      fs.writeFileSync(file, after, "utf8");
      changed++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[design-tokens] Updated ${changed} files.`);
}

main();
