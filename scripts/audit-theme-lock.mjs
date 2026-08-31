import fs from "node:fs";
import path from "node:path";

function walk(dir, predicate) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, predicate));
      continue;
    }
    if (predicate(full)) out.push(full);
  }
  return out;
}

function readFile(fullPath) {
  return fs.readFileSync(fullPath, "utf8");
}

function toPosixRelative(fullPath) {
  const rel = path.relative(process.cwd(), fullPath);
  return rel.split(path.sep).join("/");
}

function formatViolation(v) {
  return `Warning: ${v.file}:${v.line}\n   Type: ${v.type}\n   Code: ${v.content}\n`;
}

function main() {
  // Mirror scripts/audit-theme-lock.ps1 behavior, but cross-platform.
  console.log("Theme Lock Audit Starting...");

  const violations = [];
  const requiredPalette = [
    { file: "client/src/lib/themes.ts", token: 'LOCKED_TRADESCOUT_THEME_ID: ThemeId = "charcoal"' },
    { file: "client/src/lib/themes.ts", token: '"--ts-bg": "#2B2B2B"' },
    { file: "client/src/lib/themes.ts", token: '"--ts-surface": "#333333"' },
    { file: "client/src/lib/themes.ts", token: '"--ts-accent": "#FF6A00"' },
    { file: "client/tailwind.config.ts", token: 'tsBg: "#2B2B2B"' },
    { file: "client/tailwind.config.ts", token: 'tsAccent: "#FF6A00"' },
    { file: "client/src/index.css", token: "--ts-radius-card: 8px;" },
    { file: "client/src/index.css", token: "--ts-radius-control: 8px;" },
    { file: "client/src/index.css", token: "--surface-card-border:" },
    {
      file: "client/src/components/ui/card.tsx",
      token: '"ts-card text-[color:var(--text-primary)]"',
    },
    {
      file: "client/src/components/ui/input.tsx",
      token: '"ts-control flex h-[var(--ts-control-height)]',
    },
    { file: "client/src/components/ui/button.tsx", token: 'default: "ts-action font-bold"' },
  ];

  for (const item of requiredPalette) {
    const fullPath = path.join(process.cwd(), ...item.file.split("/"));
    if (!fs.existsSync(fullPath) || !readFile(fullPath).includes(item.token)) {
      violations.push({
        file: item.file,
        line: 1,
        type: "Locked TradeScout palette token changed",
        content: item.token,
      });
    }
  }

  const suspiciousHex = /#[0-9a-fA-F]{6}/g;
  const unauthorizedGradient = /(linear-gradient|radial-gradient|conic-gradient)/i;

  // Known, pre-existing, out-of-scope exceptions -- NOT a general bypass.
  // Each entry is an exact basename (never a substring), with an owner,
  // reason, and review-by date, per the theme convergence packet's "no
  // permanent generic allowlist" rule. This replaced a blanket substring
  // match on "Scout" that silently exempted every Scout file, including
  // ScoutHome.tsx -- the actual violator the packet's audit was supposed
  // to catch. New files are never covered by this list; only these named,
  // already-reviewed ones are.
  const HEX_AND_GRADIENT_EXCEPTIONS = [
    {
      file: "ScoutThread.tsx",
      reason:
        "Progress-bar gradient stop uses #ea580c, the same literal 'darker orange' value used ~10x elsewhere in index.css with no dedicated token -- adding one is a new-token decision out of scope for the Lane 1 audit-script fix.",
      owner: "theme-convergence-packet",
      reviewBy: "2026-09-01",
    },
    {
      file: "scout-landing-lite.tsx",
      reason:
        "client/src/experiments/ -- pre-existing experiment page, not part of any of the 5 convergence lanes (Scout/Direct Connect/Community/Exchange/primitives).",
      owner: "theme-convergence-packet",
      reviewBy: "2026-09-01",
    },
    {
      file: "ScoutFitters.tsx",
      reason:
        "client/src/pages/marketing/ -- marketing page, not part of any of the 5 convergence lanes.",
      owner: "theme-convergence-packet",
      reviewBy: "2026-09-01",
    },
    {
      file: "scout-info-showcase.tsx",
      reason: "client/src/pages/ marketing/info page, not part of any of the 5 convergence lanes.",
      owner: "theme-convergence-packet",
      reviewBy: "2026-09-01",
    },
  ];
  const exceptedFileNames = new Set(HEX_AND_GRADIENT_EXCEPTIONS.map((e) => e.file));
  // These are independently branded, profile-owned surfaces. Their palettes
  // are content/visualization data, not TradeScout shell-theme overrides.
  const BRANDED_SURFACE_PATH_EXCEPTIONS = [
    "client/src/pages/ProfileSiteView.tsx",
    "client/src/pages/homeid/HomeIdWorkspace.tsx",
    "client/src/pages/profile-sites/RedGranitiWebsiteProfile.tsx",
    "client/src/pages/profile-sites/SteelHomePackagesProfile.tsx",
  ];
  const BRANDED_SURFACE_DIRECTORY_EXCEPTIONS = [
    "client/src/pages/profile-sites/steel-home-project-tools/",
  ];
  const isBrandedSurface = (relativePath) =>
    BRANDED_SURFACE_PATH_EXCEPTIONS.includes(relativePath) ||
    BRANDED_SURFACE_DIRECTORY_EXCEPTIONS.some((prefix) => relativePath.startsWith(prefix));
  // Allowed files for inline colors (component-specific)
  const allowedColorFiles = ["Icons", "Logo", "Theme"];

  const clientRoot = path.join(process.cwd(), "client", "src");
  if (!fs.existsSync(clientRoot)) {
    console.error("[audit-theme-lock] missing client/src");
    process.exit(1);
  }

  console.log("\nScanning components...");

  const tsxFiles = walk(clientRoot, (p) => p.endsWith(".tsx"));
  for (const file of tsxFiles) {
    const relativePath = toPosixRelative(file);
    const fileName = path.basename(file);

    const allowHexByPath =
      /\.(?:test|spec)\.tsx$/i.test(relativePath) ||
      /test-page/i.test(relativePath) ||
      /\/demo\//i.test(relativePath) ||
      /\/sandbox\//i.test(relativePath);

    const isAllowedFile = allowedColorFiles.some((token) => fileName.includes(token));
    if (isAllowedFile) continue;
    const isExceptedFile = exceptedFileNames.has(fileName) || isBrandedSurface(relativePath);

    const content = readFile(file);
    const lines = content.split(/\r?\n/);

    if (!allowHexByPath && !isExceptedFile) {
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx] ?? "";
        if (!suspiciousHex.test(line)) continue;
        suspiciousHex.lastIndex = 0;

        // Remove CSS variable fallbacks like var(--user-primary, #f97316)
        const stripped = line
          .replace(/var\(\s*--[^,]+,\s*#[0-9a-fA-F]{6}\s*\)/gi, "")
          .replace(/placeholder\s*=\s*["']#[0-9a-fA-F]{6}["']/gi, "");

        if (suspiciousHex.test(stripped)) {
          violations.push({
            file: relativePath,
            line: idx + 1,
            type: "Inline hex color",
            content: line.trim(),
          });
        }
        suspiciousHex.lastIndex = 0;
      }
    }

    if (!isExceptedFile) {
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx] ?? "";
        if (
          /background\s*:\s*/i.test(line) ||
          /backgroundImage\s*:\s*/i.test(line) ||
          /background-image\s*:\s*/i.test(line)
        ) {
          if (unauthorizedGradient.test(line)) {
            violations.push({
              file: relativePath,
              line: idx + 1,
              type: "Unauthorized gradient",
              content: line.trim(),
            });
          }
        }
      }
    }
  }

  console.log("\nScanning CSS files...");

  const cssFiles = walk(clientRoot, (p) => p.endsWith(".css"));
  for (const file of cssFiles) {
    const relativePath = toPosixRelative(file);
    const content = readFile(file);
    const lines = content.split(/\r?\n/);

    // Skip scout-shell (allowed gradients) - mirror the PS heuristic
    if (content.includes(".scout-shell") || content.includes(".scout-gradient")) continue;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx] ?? "";
      if (!/(background\s*:|background-image\s*:)/i.test(line)) continue;
      if (unauthorizedGradient.test(line)) {
        violations.push({
          file: relativePath,
          line: idx + 1,
          type: "Unauthorized gradient in CSS",
          content: line.trim(),
        });
      }
    }
  }

  console.log("");
  if (violations.length === 0) {
    console.log("Theme Lock Audit PASSED");
    console.log(`   No violations found in ${tsxFiles.length + cssFiles.length} files`);
    process.exit(0);
  }

  console.error("Theme Lock Audit FAILED");
  console.error(`   Found ${violations.length} violations:\n`);
  for (const v of violations) {
    console.error(formatViolation(v));
  }
  process.exit(1);
}

main();
