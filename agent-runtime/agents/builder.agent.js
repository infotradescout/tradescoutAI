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

async function ensureBranchAndCommit(repoRoot, branchName, logger) {
  // Ensure we are in a git repo
  try {
    await runGit(["rev-parse", "--is-inside-work-tree"], repoRoot);
  } catch {
    throw new Error("Not a git repository");
  }

  // If branch exists, add a suffix
  let finalBranch = branchName;
  try {
    const existing = await runGit(["rev-parse", "--verify", `refs/heads/${branchName}`], repoRoot);
    if (existing) finalBranch = `${branchName}-${Date.now()}`;
  } catch {
    // branch does not exist
  }

  await runGit(["checkout", "-b", finalBranch], repoRoot);

  // Create a scoped placeholder change: a skipped test stub
  const testsDir = path.join(repoRoot, "tests");
  const agentDir = path.join(testsDir, "agent");
  await fs.mkdir(agentDir, { recursive: true });
  const filePath = path.join(agentDir, `${slugify(finalBranch)}.spec.ts`);
  const body = `// builder placeholder test (skipped)\n// TODO(agent): replace with real task later\nimport { test } from '@playwright/test';\n\ntest.skip('builder placeholder: ${finalBranch}', async () => {\n  // no-op\n});\n`;
  await fs.writeFile(filePath, body, "utf-8");

  await runGit(["add", path.relative(repoRoot, filePath)], repoRoot);
  await execFile(
    "git",
    [
      "-c",
      "user.name=TradeScout Agent",
      "-c",
      "user.email=agent@local",
      "commit",
      "-m",
      "chore(builder): scoped placeholder change [agent]",
    ],
    { cwd: repoRoot }
  );

  const commitSha = await runGit(["rev-parse", "HEAD"], repoRoot);
  const filesChangedOutput = await runGit(["diff", "--name-only", "HEAD~1..HEAD"], repoRoot);
  const filesChanged = filesChangedOutput ? filesChangedOutput.split("\n").filter(Boolean).length : 0;

  return { branch: finalBranch, commitSha, filesChanged };
}

export function createBuilderAgent() {
  return {
    id: "builder",
    async execute(task, logger) {
      const intent = task || "build-feature";
      const baseSlug = slugify(`builder-${intent}`);
      const repoRoot = path.resolve(path.join(process.cwd()));
      await logger.info("Executing builder task", { intent, branch: baseSlug });

      try {
        const { branch, commitSha, filesChanged } = await ensureBranchAndCommit(repoRoot, baseSlug, logger);
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
      } catch (error) {
        await logger.error("Builder commit failed", { error: error.message });
        throw error;
      }
    },
  };
}
