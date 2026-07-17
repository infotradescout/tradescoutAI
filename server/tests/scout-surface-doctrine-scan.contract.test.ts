import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCAN_ROOTS = [
  "client/src",
  "server/routes",
  "server/services",
  "server/scout",
  "data/TradeScout Brain",
];

const BANNED_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "Ask Scout", regex: /\bask scout\b/i },
  { label: "Ask the Scout", regex: /\bask the scout\b/i },
  { label: "Talk to Scout", regex: /\btalk to scout\b/i },
  { label: "Continue in Scout", regex: /\bcontinue in scout\b/i },
  { label: "Scout can help", regex: /\bscout can help\b/i },
  { label: "chatbot", regex: /\bchatbot\b/i },
  { label: "chat bot", regex: /\bchat bot\b/i },
  { label: "AI helper", regex: /\bai helper\b/i },
  { label: "help desk", regex: /\bhelp desk\b/i },
  { label: "support desk", regex: /\bsupport desk\b/i },
  { label: "built-in helper", regex: /\bbuilt-in helper\b/i },
  { label: "Scout Assistant", regex: /\bscout assistant\b/i },
  { label: "Virtual Assistant", regex: /\bvirtual assistant\b/i },
  { label: "AI Assistant", regex: /\bai assistant\b/i },
  { label: "Conversation Assistant", regex: /\bconversation assistant\b/i },
  { label: "AI-assistant", regex: /\bai-assistant\b/i },
  { label: "virtual-assistant", regex: /\bvirtual-assistant\b/i },
];

function shouldScan(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.includes("/exports/workspaces/")) return false;
  if (normalized.includes("/node_modules/")) return false;
  if (normalized.includes("/dist/")) return false;
  if (normalized.includes("/build/")) return false;
  if (normalized.includes("/docs/audits/")) return false;
  if (normalized.includes("/docs/history/")) return false;
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
      for (const banned of BANNED_PATTERNS) {
        if (banned.regex.test(source)) {
          violations.push({ file, phrase: banned.label });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
