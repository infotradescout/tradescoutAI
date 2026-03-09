import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

type JournalEntry = {
  idx: number;
  tag: string;
};

function getStartIdx(): number {
  const raw = process.argv.find((arg) => arg.startsWith("--from="));
  if (!raw) return 0;
  const value = Number(raw.slice("--from=".length));
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarQuoteTag: string | null = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (inLineComment) {
      current += char;
      if (char === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !dollarQuoteTag) {
      if (char === "-" && next === "-") {
        current += char + next;
        index += 1;
        inLineComment = true;
        continue;
      }

      if (char === "/" && next === "*") {
        current += char + next;
        index += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (!inDoubleQuote && !dollarQuoteTag && char === "'" && sql[index - 1] !== "\\") {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && !dollarQuoteTag && char === '"' && sql[index - 1] !== "\\") {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === "$") {
      const rest = sql.slice(index);
      const match = rest.match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        const tag = match[0];
        current += tag;
        index += tag.length - 1;
        if (dollarQuoteTag === tag) {
          dollarQuoteTag = null;
        } else if (!dollarQuoteTag) {
          dollarQuoteTag = tag;
        }
        continue;
      }
    }

    if (!inSingleQuote && !inDoubleQuote && !dollarQuoteTag && char === ";") {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail.length > 0) {
    statements.push(tail);
  }

  return statements;
}

function isSkippableDuplicate(error: unknown): boolean {
  const code = typeof error === "object" && error !== null ? String((error as any).code || "") : "";
  const message = error instanceof Error ? error.message : String(error);

  if (["42P07", "42710", "42P16"].includes(code)) {
    return true;
  }

  return /already exists/i.test(message);
}

async function main() {
  const connectionString = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL must be set");
  }

  const startIdx = getStartIdx();
  const journalPath = path.resolve(process.cwd(), "migrations/meta/_journal.json");
  const journal = JSON.parse(await fs.readFile(journalPath, "utf8")) as { entries: JournalEntry[] };
  const entries = (journal.entries || []).filter((entry) => entry.idx >= startIdx);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    for (const entry of entries) {
      const sqlPath = path.resolve(process.cwd(), "migrations", `${entry.tag}.sql`);
      const sql = await fs.readFile(sqlPath, "utf8");
      const statements = splitSqlStatements(sql);
      console.log(`[apply-migration-journal] Applying ${entry.idx}: ${entry.tag}`);
      for (const [statementIdx, statement] of statements.entries()) {
        try {
          await client.query(statement);
        } catch (error) {
          if (isSkippableDuplicate(error)) {
            console.warn(
              `[apply-migration-journal] Skipped duplicate at ${entry.idx}:${entry.tag}:${statementIdx + 1}`
            );
            continue;
          }

          throw new Error(
            `[apply-migration-journal] Failed at ${entry.idx}:${entry.tag}:${statementIdx + 1} :: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }
  } finally {
    await client.end();
  }

  console.log(
    `[apply-migration-journal] Applied ${entries.length} migration file(s) starting from idx ${startIdx}.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
