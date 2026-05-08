import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../db";

let ensurePromise: Promise<void> | null = null;

export async function ensureProcurementEngineTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "migrations",
        "0092_procurement_engine_workspaces.sql"
      );
      const sql = await readFile(migrationPath, "utf8");
      await pool.query(sql);
    })();
  }

  await ensurePromise;
}
