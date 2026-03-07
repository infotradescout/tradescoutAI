import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, "migrations");
const journalPath = path.join(migrationsDir, "meta", "_journal.json");

function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function loadJournal() {
  const current = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const entries = Array.isArray(current?.entries) ? current.entries : [];
  return {
    version: String(current?.version || "7"),
    dialect: String(current?.dialect || "postgresql"),
    entries,
  };
}

function getMigrationTags() {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .filter((file) => file !== "_all_neon_setup.sql")
    .map((file) => file.replace(/\.sql$/i, ""))
    .sort(naturalCompare);
}

function main() {
  const journal = loadJournal();
  const knownTags = new Set(journal.entries.map((entry) => String(entry.tag)));
  const tags = getMigrationTags();
  const nextEntries = [...journal.entries];

  let nextIdx = nextEntries.length;
  let nextWhen = nextEntries.length > 0 ? Number(nextEntries[nextEntries.length - 1].when) : Date.now();

  for (const tag of tags) {
    if (knownTags.has(tag)) continue;
    nextWhen += 1_000_000;
    nextEntries.push({
      idx: nextIdx,
      version: journal.version,
      when: nextWhen,
      tag,
      breakpoints: false,
    });
    nextIdx += 1;
  }

  fs.writeFileSync(
    journalPath,
    `${JSON.stringify({ version: journal.version, dialect: journal.dialect, entries: nextEntries }, null, 2)}\n`,
    "utf8"
  );

  console.log(`[drizzle:journal] Reconciled ${nextEntries.length} journal entries.`);
}

main();