import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCAN_ROOTS = ["client/src", "server"];
const BANNED_PHRASES = [
  "Ask Scout",
  "Talk to Scout",
  "Continue in Scout",
  "Scout can help",
  "chatbot",
  "chat bot",
  "AI helper",
  "help desk",
  "support desk",
  "built-in helper",
];

function shouldScan(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("/exports/workspaces/")) return false;
  if (normalized.includes("/node_modules/")) return false;
  if (normalized.includes("/dist/")) return false;
  if (normalized.includes("/build/")) return false;
  if (normalized.includes(".test.")) return false;
  if (normalized.includes(".contract.")) return false;
  return true;
}

function collectFiles(startRelativePath: string): string[] {
  const start = path.resolve(ROOT, startRelativePath);
  if (!fs.existsSync(start)) return [];

  const files: string[] = [];
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(ROOT, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!shouldScan(relativePath)) continue;
      files.push(relativePath);
    }
  }

  return files;
}

describe("Scout surface doctrine scan", () => {
  it("keeps banned phrases out of runtime and prompt sources", () => {
    const files = SCAN_ROOTS.flatMap((scanRoot) => collectFiles(scanRoot));
    const violations: Array<{ file: string; phrase: string }> = [];

    for (const file of files) {
      const source = fs.readFileSync(path.resolve(ROOT, file), "utf8");
      for (const phrase of BANNED_PHRASES) {
        if (source.includes(phrase)) {
          violations.push({ file, phrase });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
