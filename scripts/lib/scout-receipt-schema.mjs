import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SCOUT_RECEIPT_MIGRATION_TAG = "0139_scout_execution_receipts";
const migrationPath = path.resolve(process.cwd(), `migrations/${SCOUT_RECEIPT_MIGRATION_TAG}.sql`);
const lf = fs.readFileSync(migrationPath, "utf8").replace(/\r\n?/g, "\n");
export const SCOUT_RECEIPT_MIGRATION_HASHES = [...new Set([lf, lf.replace(/\n/g, "\r\n")]
  .map((value) => createHash("sha256").update(value).digest("hex")))];

// Independent catalog contract, not a test that merely finds the SQL filename.
// Exact CHECK definitions intentionally fail closed on changed logic. PostgreSQL
// renders these definitions canonically; whitespace alone is insignificant.
const columns = {
  owner_user_id: ["character varying", true, null],
  execution_id: ["character varying(128)", true, null],
  action_type: ["character varying(40)", true, null],
  request_fingerprint: ["character(64)", true, null],
  status: ["character varying(16)", true, "'pending'::character varying"],
  result: ["jsonb", false, null],
  created_at: ["timestamp with time zone", true, "now()"],
  completed_at: ["timestamp with time zone", false, null],
  last_replayed_at: ["timestamp with time zone", false, null],
  replay_count: ["integer", true, "0"],
};
const expectedChecks = [
  "CHECK (((action_type)::text = 'SAVE_PROFILE'::text))",
  "CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'unconfirmed'::character varying])::text[])))",
  "CHECK ((replay_count >= 0))",
  "CHECK (((((status)::text = 'completed'::text) AND (result IS NOT NULL) AND (completed_at IS NOT NULL)) OR (((status)::text <> 'completed'::text) AND (result IS NULL) AND (completed_at IS NULL))))",
];
const normalize = (value) => String(value).trim().replace(/\s+/g, " ");

export function evaluateScoutReceiptSchema({ attributes = [], constraints = [], indexes = [], migrationRecorded = false }) {
  const missing = [];
  const actualColumns = new Map(attributes.map((column) => [column.name, column]));
  for (const [name, [type, notNull, defaultValue]] of Object.entries(columns)) {
    const actual = actualColumns.get(name);
    if (!actual || actual.type !== type || actual.not_null !== notNull ||
        (actual.default_value == null ? null : normalize(actual.default_value)) !== defaultValue) {
      missing.push(`scout_execution_receipts.${name}[type, nullability and default]`);
    }
  }
  const validConstraints = constraints.filter((constraint) => constraint.validated === true);
  if (!validConstraints.some((constraint) => constraint.kind === "p" &&
      normalize(constraint.definition) === "PRIMARY KEY (owner_user_id, execution_id)")) {
    missing.push("scout_execution_receipts[owner/operation primary key]");
  }
  if (!validConstraints.some((constraint) => constraint.kind === "f" &&
      constraint.referenced_table === "users" &&
      normalize(constraint.definition) === "FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE")) {
    missing.push("scout_execution_receipts[authenticated owner foreign key with delete cascade]");
  }
  for (const definition of expectedChecks) {
    if (!validConstraints.some((constraint) => constraint.kind === "c" && normalize(constraint.definition) === definition)) {
      missing.push(`scout_execution_receipts[${definition}]`);
    }
  }
  if (!indexes.some((index) => index.valid === true && index.ready === true &&
      index.columns === "status, created_at" && index.partial === false)) {
    missing.push("scout_execution_receipts[valid status/created_at index]");
  }
  if (!migrationRecorded) missing.push("drizzle.__drizzle_migrations[0139 canonical hash]");
  return missing;
}

/** Read-only catalog queries; missing tables produce a failed contract, not DDL. */
export async function inspectScoutReceiptSchema(client) {
  const attributes = await client.query(`
    SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type,
      a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS default_value
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = to_regclass('public.scout_execution_receipts')
      AND a.attnum > 0 AND NOT a.attisdropped`);
  const constraints = await client.query(`
    SELECT c.contype AS kind, c.convalidated AS validated, pg_get_constraintdef(c.oid) AS definition,
      r.relname AS referenced_table
    FROM pg_constraint c LEFT JOIN pg_class r ON r.oid = c.confrelid
    WHERE c.conrelid = to_regclass('public.scout_execution_receipts')`);
  const indexes = await client.query(`
    SELECT i.indisvalid AS valid, i.indisready AS ready, (i.indpred IS NOT NULL) AS partial,
      (SELECT string_agg(a.attname, ', ' ORDER BY k.ordinality)
       FROM unnest(i.indkey) WITH ORDINALITY k(attnum, ordinality)
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum) AS columns
    FROM pg_index i WHERE i.indrelid = to_regclass('public.scout_execution_receipts')`);
  const ledger = await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present");
  const migration = ledger.rows[0]?.present ? await client.query(
    "SELECT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ANY($1::text[])) AS present",
    [SCOUT_RECEIPT_MIGRATION_HASHES]
  ) : { rows: [{ present: false }] };
  const snapshot = {
    attributes: attributes.rows, constraints: constraints.rows, indexes: indexes.rows,
    migrationRecorded: migration.rows[0]?.present === true,
  };
  const missing = evaluateScoutReceiptSchema(snapshot);
  return { contract: missing.length === 0, migrationRecorded: snapshot.migrationRecorded, missing };
}
