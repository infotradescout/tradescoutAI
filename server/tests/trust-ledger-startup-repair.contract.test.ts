import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Trust/CVS startup schema repair", () => {
  const ensureSource = read("server/ensureDb.ts");
  const migrationSource = read("migrations/0099_trust_ledger_events.sql");

  it("recreates the canonical trust ledger shape when a deploy migration was skipped", () => {
    for (const fragment of [
      "CREATE TABLE IF NOT EXISTS trust_ledger_events",
      "actor_user_id varchar REFERENCES users(id) ON DELETE SET NULL",
      "entity_type varchar(80) NOT NULL",
      "entity_id varchar(120) NOT NULL",
      "event_type varchar(120) NOT NULL",
      "source_surface varchar(80) NOT NULL",
      "verification_level varchar(40) NOT NULL DEFAULT 'none'",
      "confidence numeric(4, 3) NOT NULL DEFAULT 0.500",
      "metadata jsonb NOT NULL DEFAULT '{}'::jsonb",
      "idx_trust_ledger_entity",
      "idx_trust_ledger_event",
      "idx_trust_ledger_actor",
    ]) {
      expect(ensureSource).toContain(fragment);
      expect(migrationSource).toContain(fragment);
    }
  });
});
