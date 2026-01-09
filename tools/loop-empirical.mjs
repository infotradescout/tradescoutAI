#!/usr/bin/env node
import { spawn, execSync } from "node:child_process";

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
      ...opts,
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function runWithIdleAutoExit(cmd, args, {
  idleLineMatch = "Agent idle",
  taskStartMatch = "Starting task",
  taskCompleteMatch = "Task complete",
  hardTimeoutMs = 10 * 60 * 1000,   // 10 minutes safety
  idleGraceMs = 1500,               // wait a beat after idle shows
  requireTaskBeforeExit = false,    // set true if you ONLY want to exit after at least one task ran
} = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      shell: process.platform === "win32",
    });

    let sawTaskStart = false;
    let sawTaskComplete = false;
    let idleSeen = 0;
    let killed = false;

    const hardTimer = setTimeout(() => {
      if (killed) return;
      killed = true;
      console.error(`\n[loop] HARD TIMEOUT (${hardTimeoutMs}ms). Stopping builder...`);
      killTree(child.pid);
    }, hardTimeoutMs);

    const handleLine = (line) => {
      // Mirror output to console
      process.stdout.write(line + "\n");

      if (line.includes(taskStartMatch)) sawTaskStart = true;
      if (line.includes(taskCompleteMatch)) sawTaskComplete = true;

      if (line.includes(idleLineMatch)) {
        idleSeen += 1;

        const okToExit =
          (!requireTaskBeforeExit || sawTaskStart || sawTaskComplete);

        // If we haven't seen a task yet, still allow exit after 2 idle notices (queue truly empty)
        const queueEmptyExit = idleSeen >= 2;

        if (okToExit || queueEmptyExit) {
          if (killed) return;
          killed = true;

          setTimeout(() => {
            console.error(`\n[loop] Builder idle detected. Stopping builder so loop can continue...`);
            killTree(child.pid);
          }, idleGraceMs);
        }
      }
    };

    // Buffer and split by lines for stdout/stderr
    const wireStream = (stream, isErr = false) => {
      let buf = "";
      stream.on("data", (d) => {
        const s = d.toString();
        // also mirror raw stream to stderr if it's stderr
        if (isErr) process.stderr.write(s);
        buf += s;
        while (true) {
          const idx = buf.indexOf("\n");
          if (idx === -1) break;
          const line = buf.slice(0, idx).replace(/\r$/, "");
          buf = buf.slice(idx + 1);
          if (line.trim().length) handleLine(line);
        }
      });
      stream.on("end", () => {
        if (buf.trim().length) handleLine(buf.replace(/\r$/, ""));
      });
    };

    wireStream(child.stdout, false);
    wireStream(child.stderr, true);

    child.on("close", (code) => {
      clearTimeout(hardTimer);
      resolve(code ?? 1);
    });
  });
}

function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      // Kill process tree on Windows
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
      setTimeout(() => {
        try { process.kill(pid, "SIGKILL"); } catch {}
      }, 1200);
    }
  } catch {
    // ignore
  }
}

async function main() {
  // 1) Verifier (truthful exit codes)
  const v = await run(npmCmd(), ["run", "verifier:write-backlog"]);
  // We observe v but do not stop; loop continues empirically.

  // 2) Builder — run, then auto-exit on idle so we can reach final verify.
  // This avoids changing agent-supervisor.js.
  const b = await runWithIdleAutoExit(npmCmd(), ["run", "agents:builder"], {
    idleLineMatch: "Agent idle",
    taskStartMatch: "Starting task",
    taskCompleteMatch: "Task complete",
    hardTimeoutMs: 10 * 60 * 1000,
    idleGraceMs: 1500,
    requireTaskBeforeExit: false,
  });

  // 3) Final verify is the truth signal for the whole loop.
  const final = await run(npmCmd(), ["run", "verify"]);
  process.exit(final);
}

main().catch((err) => {
  console.error(err?.stack || err);
  process.exit(2);
});
