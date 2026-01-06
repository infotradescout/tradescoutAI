#!/usr/bin/env node
/**
 * Empirical Verifier:
 * - Runs `npm run verify`
 * - If PASS: does not touch backlog
 * - If FAIL: writes backlog.json tasks grounded in real output
 *
 * Designed for Windows + PowerShell.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function writeText(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function findBacklogFile() {
  const candidates = [
    path.join(ROOT, "backlog.json"),
    path.join(ROOT, "agent-runtime", "backlog.json"),
    path.join(ROOT, "agent_runtime", "backlog.json"),
  ].filter(fileExists);

  if (candidates.length === 1) return candidates[0];

  if (candidates.length === 0) {
    // Default to agent-runtime/backlog.json as canonical ticket store
    const target = path.join(ROOT, "agent-runtime", "backlog.json");
    ensureDir(path.dirname(target));
    return target;
  }

  // Multiple found — refuse to guess.
  const msg =
    `Multiple backlog.json files found:\n` +
    candidates.map((c) => ` - ${c}`).join("\n") +
    `\n\nDelete/rename one, or keep only one canonical backlog.json.`;
  throw new Error(msg);
}

function normalizeLines(s) {
  return s.replace(/\r\n/g, "\n").split("\n");
}

function takeFirstNonEmpty(lines) {
  for (const l of lines) {
    const t = l.trim();
    if (t) return t;
  }
  return "";
}

/**
 * Very conservative parsing:
 * - We do NOT invent tasks beyond what the output shows.
 * - We create a small number of high-signal tickets:
 *   1) Typecheck/TS failures
 *   2) ESLint failures
 *   3) Vitest failing tests
 *   4) Playwright failing tests
 *   5) Any remaining verify failure (catch-all)
 */
function extractTicketsFromVerifyOutput(output) {
  const lines = normalizeLines(output);

  const tickets = [];
  const pushTicket = (kind, title, evidenceLines) => {
    const evidence = evidenceLines.slice(0, 120); // keep grounded but bounded
    tickets.push({ kind, title, evidence });
  };

  // TypeScript (parse into structured per-file errors)
  const tsLines = lines.filter((l) => /TS\d{4}/i.test(l));
  const tsErrorRe = /^(.+?\.(?:ts|tsx))\((\d+),(\d+)\):\s*(?:error\s+)?TS(\d{4}):\s+(.+)$/i;
  const tsByFile = new Map();
  for (const raw of tsLines) {
    const line = raw.trim();
    const match = tsErrorRe.exec(line);
    if (!match) continue;
    const [, file, lineStr, colStr, codeNum, message] = match;
    const err = {
      file,
      line: Number(lineStr),
      column: Number(colStr),
      code: `TS${codeNum}`,
      message,
    };
    const existing = tsByFile.get(file) || [];
    existing.push(err);
    tsByFile.set(file, existing);
  }

  if (tsByFile.size > 0) {
    for (const [file, errors] of tsByFile.entries()) {
      const evidenceLines = errors.map((e) => `${e.file}(${e.line},${e.column}): ${e.code}: ${e.message}`);
      tickets.push({
        kind: "typecheck",
        title: `Fix TypeScript errors in ${file}`,
        evidence: evidenceLines,
        file,
        errors,
      });
    }
  } else {
    // Fallback: if we saw TS lines but couldn't parse them, keep the coarse ticket
    const tsHits = lines.filter((l) => /\bTS\d{4}\b/.test(l) || /error TS\d{4}/i.test(l));
    if (tsHits.length) {
      pushTicket(
        "typecheck",
        `Fix TypeScript errors surfaced by verify (${tsHits.length} hits)` ,
        tsHits
      );
    }
  }

  // ESLint (common patterns)
  const eslintHits = lines.filter((l) => /\beslint\b/i.test(l) && /\b(error|warning)\b/i.test(l));
  if (eslintHits.length) {
    pushTicket(
      "lint",
      `Fix ESLint issues surfaced by verify (${eslintHits.length} hits)` ,
      eslintHits
    );
  }

  // Vitest (common patterns)
  const vitestFailLines = lines.filter((l) => /^\s*FAIL\s+/i.test(l) || /\bVitest\b/i.test(l) && /\bfail(ed|ure)?\b/i.test(l));
  if (vitestFailLines.length) {
    // Try to surface first FAIL line as title
    const firstFail = takeFirstNonEmpty(vitestFailLines.filter((l) => /^\s*FAIL\s+/i.test(l))) || "Vitest failures";
    pushTicket(
      "tests:unit",
      `Fix unit/integration test failure: ${firstFail}`.slice(0, 180),
      vitestFailLines
    );
  }

  // Playwright (common patterns)
  const pwHits = lines.filter((l) => /\bplaywright\b/i.test(l) || /\bTest failed\b/i.test(l) || /\bexpect\(/i.test(l) && /\btoBe|toEqual|toContain|toHave/i.test(l));
  const pwFailish = lines.filter((l) => /\b(\d+)\s+failed\b/i.test(l) && /\bpassed\b/i.test(l));
  if (pwHits.length || pwFailish.length) {
    const evidence = [...pwFailish, ...pwHits].filter(Boolean);
    pushTicket(
      "tests:e2e",
      `Fix E2E failures surfaced by verify`,
      evidence.length ? evidence : pwHits
    );
  }

  // Catch-all: if verify fails but we didnt confidently classify, capture the tail
  if (tickets.length === 0) {
    const tail = lines.slice(Math.max(0, lines.length - 200));
    pushTicket("verify", "Fix verify failure (unclassified)  use log evidence", tail);
  }

  return tickets;
}

function buildBacklogTasks(tickets, logPath) {
  const stamp = nowStamp();

  // Match the task shape you already use (id/type/owner/priority/intent/scope/acceptance)
  // Keep scope consistent with your agent constraints; do not widen authority.
  const tasks = tickets.map((t, idx) => {
    const id = `TS-VERIFY-${stamp}-${String(idx + 1).padStart(2, "0")}`;
    const intent = `${t.title}\nEvidence log: ${logPath}`;

    // Task type aligns with what you described; keep it general.
    const type =
      t.kind.startsWith("tests") ? "test-fix" :
      t.kind === "typecheck" ? "type-fix" :
      t.kind === "lint" ? "lint-fix" :
      "verify-fix";

    // Empiricism: acceptance is always verify green.
    const acceptance = [
      "npm run verify passes",
      "No stub-only artifacts (tests/agent/* only) accepted",
      `Evidence is in ${logPath}`
    ];

    if (t.kind === "typecheck" && t.file) {
      const codes = Array.isArray(t.errors)
        ? Array.from(new Set(t.errors.map((e) => e.code))).filter(Boolean)
        : [];
      const codeLabel = codes.length ? codes.join(", ") : "TypeScript";
      acceptance.push(
        `${codeLabel} errors in ${t.file} no longer appear in npm run check`
      );
    }

    // Paths: we do not guess. Instead we forbid stub-only zones explicitly and,
    // when we have precise files, require touching them.
    const guardrails = {
      forbidden_paths: ["tests/agent/**", "agent-runtime/**/tests/agent/**"],
      // Optional: encourage runtime change without forcing guesses
      encourage_paths: ["client/**", "server/**", "shared/**", "src/**"],
    };

    if (t.kind === "typecheck" && t.file) {
      guardrails.must_touch_paths = [t.file];
    }

    return {
      id,
      type,
      owner: "builder",
      priority: "P1",
      intent,
      scope: { write: "branches_only", db: "seed_only" },
      acceptance,
      evidence: t.evidence,
      guardrails,
    };
  });

  return tasks;
}

async function run() {
  const stamp = nowStamp();
  const logsDir = path.join(ROOT, "logs");
  ensureDir(logsDir);
  const logPath = path.join(logsDir, `verify-${stamp}.log`);

  console.log(`[verifier] Running: npm run verify`);
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCmd, ["run", "verify"], {
    cwd: ROOT,
    env: process.env,
    shell: process.platform === "win32",
  });

  let out = "";
  child.stdout.on("data", (d) => {
    const s = d.toString();
    process.stdout.write(s);
    out += s;
  });
  child.stderr.on("data", (d) => {
    const s = d.toString();
    process.stderr.write(s);
    out += s;
  });

  const exitCode = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
  });

  writeText(logPath, out);
  console.log(`\n[verifier] verify log saved: ${logPath}`);

  if (exitCode === 0) {
    console.log(`[verifier] PASS  verify is green. backlog unchanged.`);
    process.exit(0);
  }

  const tickets = extractTicketsFromVerifyOutput(out);
  const tasks = buildBacklogTasks(tickets, logPath);

  const backlogFile = findBacklogFile();
  const backlog = { generated_at: new Date().toISOString(), source: "npm run verify", tasks };

  writeText(backlogFile, JSON.stringify(backlog, null, 2) + os.EOL);
  console.log(`[verifier] FAIL  wrote ${tasks.length} task(s) to ${backlogFile}`);
  // Exit non-zero so callers can treat verify failure as red.
  process.exit(1);
}

run().catch((err) => {
  console.error(`[verifier] ERROR: ${err?.stack || err}`);
  process.exit(2);
});
