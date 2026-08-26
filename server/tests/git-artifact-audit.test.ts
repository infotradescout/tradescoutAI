import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { classifyAgentCompletion } from "../../agent-runtime/completion-state.js";
import { auditGitArtifact } from "../../agent-runtime/git-artifact-audit.js";

const temporaryRoots: string[] = [];

function git(root: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "git-artifact-audit-"));
  temporaryRoots.push(root);
  git(root, ["init"]);
  git(root, ["checkout", "-b", "proof-branch"]);
  git(root, ["config", "user.name", "Completion Proof Test"]);
  git(root, ["config", "user.email", "completion-proof@example.test"]);
  return root;
}

function commitFile(root: string, relativePath: string, content: string): string {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  git(root, ["add", relativePath]);
  git(root, ["commit", "-m", "test: " + relativePath]);
  return git(root, ["rev-parse", "HEAD"]);
}

function artifact(commit: string, filesChanged = 1, branch = "proof-branch") {
  return {
    type: "git-branch",
    uri: "local://branch/" + branch,
    commit,
    files_changed: filesChanged,
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("repository-backed git artifact audit", () => {
  it("verifies the current commit and computes authoritative files", () => {
    const root = createRepo();
    const commit = commitFile(root, "server/proof.ts", "export const proof = true;\n");
    const audit = auditGitArtifact({
      repoRoot: root,
      artifact: artifact(commit),
      task: { guardrails: { must_touch_paths: ["server/proof.ts"] } },
    });

    expect(audit.status).toBe("verified");
    expect(audit.commit).toBe(commit);
    expect(audit.filesChanged).toBe(1);
    expect(audit.changedFiles).toEqual(["server/proof.ts"]);
    expect(classifyAgentCompletion({ artifact: artifact(commit) }, audit)).toBe(
      "success"
    );
  });

  it("fails a fabricated commit", () => {
    const root = createRepo();
    commitFile(root, "server/proof.ts", "export const proof = true;\n");
    const audit = auditGitArtifact({
      repoRoot: root,
      artifact: artifact("f".repeat(40)),
    });
    expect(audit.status).toBe("failed");
    expect(audit.reason).toBe("audit_failed");
    expect(classifyAgentCompletion({}, audit)).toBe("failed");
  });

  it("fails an invented file count", () => {
    const root = createRepo();
    const commit = commitFile(root, "server/proof.ts", "export const proof = true;\n");
    const audit = auditGitArtifact({
      repoRoot: root,
      artifact: artifact(commit, 99),
    });
    expect(audit.status).toBe("failed");
    expect(audit.reason).toBe("file_count_mismatch");
  });

  it("fails a real historical commit that is no longer HEAD", () => {
    const root = createRepo();
    const oldCommit = commitFile(root, "server/requested.ts", "export const old = true;\n");
    commitFile(root, "server/unrelated.ts", "export const next = true;\n");
    const audit = auditGitArtifact({
      repoRoot: root,
      artifact: artifact(oldCommit),
    });
    expect(audit.status).toBe("failed");
    expect(audit.reason).toBe("commit_not_head");
  });

  it("fails a commit that misses every required path", () => {
    const root = createRepo();
    const commit = commitFile(root, "server/other.ts", "export const other = true;\n");
    const audit = auditGitArtifact({
      repoRoot: root,
      artifact: artifact(commit),
      task: { guardrails: { must_touch_paths: ["client/required.tsx"] } },
    });
    expect(audit.status).toBe("failed");
    expect(audit.reason).toBe("required_path_missing");
  });

  it("leaves documentation-only work unverified without a required path", () => {
    const root = createRepo();
    const commit = commitFile(root, "docs/note.md", "not material proof\n");
    const audit = auditGitArtifact({
      repoRoot: root,
      artifact: artifact(commit),
    });
    expect(audit.status).toBe("unverified");
    expect(audit.reason).toBe("non_material_diff");
    expect(classifyAgentCompletion({}, audit)).toBe("unverified");
  });

  it("fails when the intended repository cannot be audited", () => {
    const root = path.join(os.tmpdir(), "missing-git-audit-" + Date.now());
    const audit = auditGitArtifact({
      repoRoot: root,
      artifact: artifact("a".repeat(40)),
    });
    expect(audit.status).toBe("failed");
    expect(audit.reason).toBe("audit_failed");
  });

  it("fails a branch URI that does not match the checked-out branch", () => {
    const root = createRepo();
    const commit = commitFile(root, "server/proof.ts", "export const proof = true;\n");
    const audit = auditGitArtifact({
      repoRoot: root,
      artifact: artifact(commit, 1, "invented-branch"),
    });
    expect(audit.status).toBe("failed");
    expect(audit.reason).toBe("branch_mismatch");
  });

  it("fails a forbidden path", () => {
    const root = createRepo();
    const commit = commitFile(root, "server/private/secret.ts", "export const secret = true;\n");
    const audit = auditGitArtifact({
      repoRoot: root,
      artifact: artifact(commit),
      task: { guardrails: { forbidden_paths: ["server/private/**"] } },
    });
    expect(audit.status).toBe("failed");
    expect(audit.reason).toBe("forbidden_path_touched");
  });

  it("never trusts an artifact when the audit is omitted", () => {
    expect(
      classifyAgentCompletion({
        completion: "success",
        artifact: artifact("a".repeat(40)),
      })
    ).toBe("unverified");
  });
});
