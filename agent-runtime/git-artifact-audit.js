import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const MATERIAL_ROOTS = [
  "agent-runtime/",
  "client/",
  "scripts/",
  "server/",
  "shared/",
  "src/",
];

function normalizeRepoPath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}

function withoutGlob(value) {
  return normalizeRepoPath(value).replace(/\/(?:\*\*|\*)$/, "");
}

function isSameOrDescendant(file, requested) {
  const target = withoutGlob(requested);
  return Boolean(target) && (file === target || file.startsWith(target + "/"));
}

function response(status, reason, extra = {}) {
  return {
    status,
    reason,
    flags: reason ? ["git_artifact_" + reason] : [],
    ...extra,
  };
}

function runGit(repoRoot, args) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Verify a git artifact against the intended repository.
 *
 * Reported commit and file counts are inputs to check, never proof to trust.
 */
export function auditGitArtifact({ repoRoot, artifact, task = {} }) {
  if (artifact?.type !== "git-branch") {
    return response("not_applicable", "not_git_branch");
  }

  const reportedCommit =
    typeof artifact.commit === "string" ? artifact.commit.trim() : "";
  const reportedFilesChanged = artifact.files_changed;

  if (
    !reportedCommit ||
    !Number.isInteger(reportedFilesChanged) ||
    reportedFilesChanged < 0
  ) {
    return response("unverified", "missing_reported_proof", {
      reported: {
        commit: reportedCommit || null,
        filesChanged: Number.isInteger(reportedFilesChanged)
          ? reportedFilesChanged
          : null,
      },
    });
  }

  try {
    const intendedRoot = fs.realpathSync(path.resolve(repoRoot));
    const actualRoot = fs.realpathSync(runGit(intendedRoot, [
      "rev-parse",
      "--show-toplevel",
    ]));

    if (actualRoot !== intendedRoot) {
      return response("failed", "repository_root_mismatch", {
        repoRoot: intendedRoot,
        actualRoot,
      });
    }

    const prefix = "local://branch/";
    if (
      typeof artifact.uri !== "string" ||
      !artifact.uri.startsWith(prefix) ||
      artifact.uri.length === prefix.length
    ) {
      return response("failed", "invalid_branch_uri");
    }

    const reportedBranch = artifact.uri.slice(prefix.length);
    const currentBranch = runGit(intendedRoot, ["branch", "--show-current"]);
    if (currentBranch !== reportedBranch) {
      return response("failed", "branch_mismatch", {
        reportedBranch,
        currentBranch,
      });
    }

    const commit = runGit(intendedRoot, [
      "rev-parse",
      "--verify",
      reportedCommit + "^{commit}",
    ]);
    const head = runGit(intendedRoot, ["rev-parse", "HEAD"]);

    if (commit !== head) {
      return response("failed", "commit_not_head", {
        reportedCommit,
        commit,
        head,
      });
    }

    const rawFiles = runGit(intendedRoot, [
      "diff-tree",
      "--root",
      "--no-commit-id",
      "--name-only",
      "-r",
      commit,
    ]);
    const changedFiles = rawFiles
      ? rawFiles
          .split("\n")
          .map(normalizeRepoPath)
          .filter(Boolean)
      : [];

    if (changedFiles.length === 0) {
      return response("failed", "empty_diff", { commit });
    }

    if (reportedFilesChanged !== changedFiles.length) {
      return response("failed", "file_count_mismatch", {
        reportedFilesChanged,
        computedFilesChanged: changedFiles.length,
        changedFiles,
      });
    }

    const requiredPaths = Array.isArray(task?.guardrails?.must_touch_paths)
      ? task.guardrails.must_touch_paths.map(withoutGlob).filter(Boolean)
      : [];
    const forbiddenPaths = Array.isArray(task?.guardrails?.forbidden_paths)
      ? task.guardrails.forbidden_paths.map(withoutGlob).filter(Boolean)
      : [];

    const missingRequired = requiredPaths.filter(
      (required) =>
        !changedFiles.some((file) => isSameOrDescendant(file, required))
    );
    if (missingRequired.length > 0) {
      return response("failed", "required_path_missing", {
        changedFiles,
        requiredPaths,
        missingRequired,
      });
    }

    const forbiddenChanged = changedFiles.filter((file) =>
      forbiddenPaths.some((forbidden) =>
        isSameOrDescendant(file, forbidden)
      )
    );
    if (forbiddenChanged.length > 0) {
      return response("failed", "forbidden_path_touched", {
        changedFiles,
        forbiddenPaths,
        forbiddenChanged,
      });
    }

    if (
      requiredPaths.length === 0 &&
      !changedFiles.some((file) =>
        MATERIAL_ROOTS.some((root) => file.startsWith(root))
      )
    ) {
      return response("unverified", "non_material_diff", { changedFiles });
    }

    return {
      status: "verified",
      reason: "repository_proof_verified",
      flags: [],
      repoRoot: intendedRoot,
      branch: currentBranch,
      commit,
      filesChanged: changedFiles.length,
      changedFiles,
      reported: {
        commit: reportedCommit,
        filesChanged: reportedFilesChanged,
      },
    };
  } catch (error) {
    return response("failed", "audit_failed", {
      error: error instanceof Error ? error.message : String(error),
      reported: {
        commit: reportedCommit,
        filesChanged: reportedFilesChanged,
      },
    });
  }
}
