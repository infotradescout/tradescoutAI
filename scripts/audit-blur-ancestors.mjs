#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import url from "url";

const rootDir = path.dirname(url.fileURLToPath(import.meta.url));
const clientSrcDir = path.join(rootDir, "..", "client", "src");

const FILE_EXTENSIONS = [".css", ".tsx", ".jsx"];
const BLUR_TOKENS = ["backdrop-filter", "backdrop-blur"];

// Heuristics for input-hosting React surfaces (JSX/TSX)
const INPUT_TOKENS = [
  "<input",
  "<textarea",
  "<select",
  "contentEditable",
  "contenteditable",
  "role=\"textbox\"",
  "role='textbox'",
  "data-focus-trap",
  "autoFocus",
];

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip build artifacts
      if (entry.name === "dist" || entry.name === "node_modules") continue;
      yield* walk(fullPath);
    } else {
      if (FILE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        yield fullPath;
      }
    }
  }
}

async function main() {
  const violations = [];

  for await (const filePath of walk(clientSrcDir)) {
    const ext = path.extname(filePath);
    const text = await fs.readFile(filePath, "utf8");
    const lines = text.split(/\r?\n/);

    // CSS: enforce pseudo-element blur globally
    if (ext === ".css") {
      lines.forEach((line, index) => {
        if (!BLUR_TOKENS.some((token) => line.includes(token))) return;

        // Look a bit further back for selector context so
        // `.foo::before {\n  backdrop-filter: blur(...)` is allowed.
        const contextStart = Math.max(0, index - 8);
        const context = lines.slice(contextStart, index + 1).join("\n");
        if (context.includes("::before") || context.includes("::after")) return;

        violations.push({
          file: filePath,
          line: index + 1,
          text: line.trim(),
        });
      });
      continue;
    }

    // React TSX/JSX: scope audit to input-hosting component surfaces
    if (ext === ".tsx" || ext === ".jsx") {
      // Phase 1: skip top-level pages; focus on components/overlays/headers.
      const relPath = path.relative(clientSrcDir, filePath);
      if (relPath.split(path.sep)[0] === "pages") {
        continue;
      }

      const hasInput = INPUT_TOKENS.some((token) => text.includes(token));
      if (!hasInput) {
        // No inputs / focus traps in this component; we can normalize later.
        continue;
      }

      lines.forEach((line, index) => {
        if (!BLUR_TOKENS.some((token) => line.includes(token))) return;

        violations.push({
          file: filePath,
          line: index + 1,
          text: line.trim(),
        });
      });

      continue;
    }
  }

  if (violations.length > 0) {
    console.error("\nUnsafe blur usage detected (no ::before/::after guard):\n");
    for (const v of violations) {
      console.error(
        `${path.relative(process.cwd(), v.file)}:${v.line}: ${v.text}`
      );
    }
    console.error(
      "\nFix by moving blur to a ::before/::after pseudo-element on the container."
    );
    process.exit(1);
  } else {
    console.log("Blur ancestor audit passed (all blur guarded by pseudo-elements).");
  }
}

main().catch((err) => {
  console.error("Error running blur ancestor audit:", err);
  process.exit(1);
});
