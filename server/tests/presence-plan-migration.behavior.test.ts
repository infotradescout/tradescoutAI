import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const digest = "a".repeat(64);
const hash = "b".repeat(64);

describe("presence plan migration", () => {
  it("keeps drafts tied to canonical identities and cannot mistake plan review for an action grant", async () => {
    const database = new PGlite();
    try {
      await database.exec(`
        CREATE TABLE users (id varchar PRIMARY KEY);
        CREATE TABLE businesses (id varchar PRIMARY KEY);
        CREATE TABLE profiles (id varchar PRIMARY KEY);
        INSERT INTO users VALUES ('owner-1'), ('other-owner');
        INSERT INTO businesses VALUES ('business-1');
        INSERT INTO profiles VALUES ('profile-1');
      `);
      await database.exec(
        readFileSync(resolve(process.cwd(), "migrations/0142_business_presence_plans.sql"), "utf8")
      );

      await database.query(
        `INSERT INTO business_presence_plans
          (id, owner_user_id, business_id, profile_id, evidence_digest, plan_hash, plan)
         VALUES ('plan-1', 'owner-1', 'business-1', 'profile-1', $1, $2, '{}'::jsonb)`,
        [digest, hash]
      );
      await expect(
        database.query(
          `INSERT INTO business_presence_plans
            (id, owner_user_id, business_id, profile_id, evidence_digest, plan_hash, plan)
           VALUES ('plan-2', 'owner-1', 'business-1', 'profile-1', $1, $2, '{}'::jsonb)`,
          [digest, hash]
        )
      ).rejects.toThrow();
      await expect(
        database.query(
          `INSERT INTO business_presence_plans
            (id, owner_user_id, business_id, profile_id, evidence_digest, plan_hash, plan)
           VALUES ('plan-3', 'owner-1', 'missing', 'profile-1', $1, $2, '{}'::jsonb)`,
          [digest, hash]
        )
      ).rejects.toThrow();
      await expect(
        database.query(
          `UPDATE business_presence_plans SET site_path='keep_external',
           site_path_selected_by='other-owner', reviewed_at=now() WHERE id='plan-1'`
        )
      ).rejects.toThrow();

      const result = await database.query<{
        revision: number;
        site_path: string | null;
        reviewed_at: string | null;
      }>("SELECT revision, site_path, reviewed_at FROM business_presence_plans WHERE id='plan-1'");
      expect(result.rows).toEqual([{ revision: 1, site_path: null, reviewed_at: null }]);
    } finally {
      await database.close();
    }
  });
});
