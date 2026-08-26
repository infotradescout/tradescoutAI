import { jitteredDelay, slugify, sleep } from "../agent-utils.js";
import { execFile as _execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execFile = promisify(_execFile);

async function runGit(args, cwd) {
  const { stdout } = await execFile("git", args, { cwd });
  return stdout.trim();
}

async function ensureGitRepo(repoRoot) {
  // Ensure we are in a git repo
  try {
    await runGit(["rev-parse", "--is-inside-work-tree"], repoRoot);
  } catch {
    throw new Error("Not a git repository");
  }
}

async function ensureBranch(repoRoot, branchName) {
  await ensureGitRepo(repoRoot);

  // If branch exists, add a suffix
  let finalBranch = branchName;
  try {
    const existing = await runGit(["rev-parse", "--verify", `refs/heads/${branchName}`], repoRoot);
    if (existing) finalBranch = `${branchName}-${Date.now()}`;
  } catch {
    // branch does not exist
  }

  await runGit(["checkout", "-b", finalBranch], repoRoot);

  return finalBranch;
}

async function runNpmCheck(repoRoot) {
  const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    const { stdout, stderr } = await execFile(cmd, ["run", "check"], { cwd: repoRoot });
    return { code: 0, output: `${stdout || ""}${stderr || ""}` };
  } catch (error) {
    const stdout = error.stdout || "";
    const stderr = error.stderr || "";
    const code = typeof error.code === "number" ? error.code : 1;
    return { code, output: `${stdout || ""}${stderr || ""}` };
  }
}

function countTsErrorsForFile(output, targetFile) {
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  const normTarget = targetFile.replace(/\\/g, "/");
  const reParen = /^(.+?\.(?:ts|tsx))\((\d+),(\d+)\):\s*(?:error\s+)?TS(\d{4})/i;
  const reColon = /^(.+?\.(?:ts|tsx)):(\d+):(\d+)\s*-\s*(?:error\s+)?TS(\d{4})/i;
  let count = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let m = reParen.exec(line) || reColon.exec(line);
    if (!m) continue;
    const file = m[1].replace(/\\/g, "/");
    if (file === normTarget) {
      count += 1;
    }
  }
  return count;
}

async function executeTypecheckTask(task, intent, logger) {
  const repoRoot = path.resolve(path.join(process.cwd()));
  const mustTouch = Array.isArray(task?.guardrails?.must_touch_paths)
    ? task.guardrails.must_touch_paths
    : [];
  const targetRel = mustTouch[0];

  if (!targetRel || typeof targetRel !== "string") {
    await logger.error("Typecheck task missing must_touch_paths", { intent, task });
    return {
      artifact: {
        type: "builder-blocked",
        uri: `local://builder-blocked/${slugify(intent)}`,
        files_changed: 0,
      },
      intent,
      completion: "blocked",
      flags: ["typecheck_blocked_missing_target"],
    };
  }

  const targetFile = targetRel.replace(/\\/g, "/");
  const targetPath = path.join(repoRoot, targetFile);

  try {
    await fs.access(targetPath);
  } catch {
    await logger.error("Typecheck target file not found", { intent, targetFile });
    return {
      artifact: {
        type: "builder-blocked",
        uri: `local://builder-blocked/${slugify(intent)}`,
        files_changed: 0,
      },
      intent,
      completion: "blocked",
      flags: ["typecheck_blocked_missing_file"],
    };
  }

  const baseSlug = slugify(`builder-${intent}`);
  await logger.info("Executing typecheck builder task", { intent, targetFile, branch: baseSlug });

  const branch = await ensureBranch(repoRoot, baseSlug);

  const before = await runNpmCheck(repoRoot);
  const beforeCount = countTsErrorsForFile(before.output, targetFile);

  const original = await fs.readFile(targetPath, "utf-8");

  // Single deterministic attempt (tries=1): for now, we make a no-op probe edit
  // and rely on future heuristics to apply safe fixes. If no improvement,
  // we revert and block without committing.
  await fs.appendFile(
    targetPath,
    "\n// __builder_probe (no-op, typecheck ticket — no automatic fix applied)\n"
  );

  const after = await runNpmCheck(repoRoot);
  const afterCount = countTsErrorsForFile(after.output, targetFile);

  if (afterCount < beforeCount) {
    await runGit(["add", targetFile], repoRoot);
    await execFile(
      "git",
      [
        "-c",
        "user.name=TradeScout Agent",
        "-c",
        "user.email=agent@local",
        "commit",
        "-m",
        `chore(builder): typecheck fix for ${targetFile} [agent]`,
      ],
      { cwd: repoRoot }
    );

    const commitSha = await runGit(["rev-parse", "HEAD"], repoRoot);
    const filesChangedOutput = await runGit([
      "diff",
      "--name-only",
      "HEAD~1..HEAD",
    ], repoRoot);
    const filesChanged = filesChangedOutput
      ? filesChangedOutput.split("\n").filter(Boolean).length
      : 0;

    await sleep(jitteredDelay(200, 400));
    return {
      artifact: {
        type: "git-branch",
        uri: `local://branch/${branch}`,
        commit: commitSha,
        files_changed: filesChanged,
      },
      intent,
    };
  }

  // No improvement: revert file and block without committing.
  await fs.writeFile(targetPath, original, "utf-8");
  await logger.info("Typecheck builder task blocked — no improvement in TS errors", {
    intent,
    targetFile,
    beforeCount,
    afterCount,
  });

  return {
    artifact: {
      type: "builder-blocked",
      uri: `local://builder-blocked/${slugify(intent)}`,
      files_changed: 0,
    },
    intent,
      completion: "blocked",
    flags: ["typecheck_blocked_no_improvement"],
  };
}

export function createBuilderAgent() {
  return {
    id: "builder",
    async execute(task, logger) {
      const intent =
        typeof task === "string"
          ? task
          : task && task.intent
            ? task.intent
            : "build-feature";
      const repoRoot = path.resolve(path.join(process.cwd()));

      const isTypecheckTask =
        task &&
        (task.type === "type-fix" || task.type === "typecheck" || task.kind === "typecheck") &&
        Array.isArray(task.guardrails?.must_touch_paths) &&
        task.guardrails.must_touch_paths.length > 0;

      if (isTypecheckTask) {
        try {
          return await executeTypecheckTask(task, intent, logger);
        } catch (error) {
          await logger.error("Builder typecheck flow failed", { error: error.message });
          throw error;
        }
      }

      await logger.warn("Builder task blocked: no task-specific implementation", {
        intent,
        task,
      });
      return {
        artifact: {
          type: "builder-blocked",
          uri: "local://builder-blocked/" + slugify(intent),
          files_changed: 0,
        },
        intent,
        completion: "blocked",
        flags: ["builder_blocked_missing_task_specific_implementation"],
      };
    },
  };
}
