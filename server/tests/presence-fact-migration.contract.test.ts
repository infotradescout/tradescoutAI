import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Presence fact decision migration registration", () => {
  it("registers 0145 after the task cleanup migration so the migration runner applies it", () => {
    const journal = JSON.parse(readFileSync(resolve("migrations/meta/_journal.json"), "utf8"));
    const entries = journal.entries as Array<{
      idx: number;
      version: string;
      when: number;
      tag: string;
    }>;
    const position = entries.findIndex(
      (entry) => entry.tag === "0145_business_presence_fact_decisions"
    );
    expect(position).toBeGreaterThan(0);
    const previous = entries[position - 1];
    const current = entries[position];
    expect(previous.tag).toBe("0144_business_presence_task_delete_archive");
    expect(current.idx).toBe(previous.idx + 1);
    expect(current.version).toBe(previous.version);
    expect(current.when).toBeGreaterThan(previous.when);
    expect(readFileSync(resolve(`migrations/${current.tag}.sql`), "utf8")).toContain(
      "CREATE TABLE business_presence_fact_decisions"
    );
  });
});
