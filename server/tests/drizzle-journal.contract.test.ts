import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function getRepoRoot() {
  return path.resolve(process.cwd());
}

function getSqlMigrationTags(repoRoot: string) {
  return fs
    .readdirSync(path.join(repoRoot, "migrations"))
    .filter((file) => /^\d{4}_.+\.sql$/i.test(file))
    .map((file) => file.replace(/\.sql$/i, ""))
    .sort(naturalCompare);
}

function getJournalTags(repoRoot: string) {
  const journalPath = path.join(repoRoot, "migrations", "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const entries = Array.isArray(journal?.entries) ? journal.entries : [];
  return entries.map((entry) => String(entry?.tag || ""));
}

describe("drizzle journal contracts", () => {
  it("tracks every numbered SQL migration and keeps the latest tag aligned", () => {
    const repoRoot = getRepoRoot();
    const sqlTags = getSqlMigrationTags(repoRoot);
    const journalTags = getJournalTags(repoRoot);
    const missingTags = sqlTags.filter((tag) => !journalTags.includes(tag));
    const extraTags = journalTags.filter((tag) => !sqlTags.includes(tag));

    expect(missingTags).toEqual([]);
    expect(extraTags).toEqual([]);
    expect(journalTags.at(-1)).toBe(sqlTags.at(-1));
  });
});
