import { pool } from "./db";
import type { NextFunction, Request, Response } from "express";

type DriftSeverity = "info" | "warn" | "error";

interface DriftIssue {
  scope: string;
  code: string;
  message: string;
  severity: DriftSeverity;
}

const EXPECTED_USER_COLUMNS = [
  "state_code",
  "county_fips",
  "county_id",
  "county_name",
  "latitude",
  "longitude",
];

const EXPECTED_BUSINESS_COLUMNS = ["public_discovery_enabled"];

const EXPECTED_MARKETPLACE_SCHEMA: Readonly<Record<string, readonly string[]>> = {
  stone_materials: ["source_business_id", "slug"],
  stone_asset_passports: ["public_id", "material_id"],
  stone_inventory_positions: [
    "asset_passport_id",
    "holder_business_id",
    "held_quantity",
    "publication_evidence",
    "version",
  ],
  stone_inventory_delegations: ["holder_business_id", "delegate_user_id", "scopes"],
  profile_accounts: ["owner_user_id", "business_profile_id", "status", "source_path"],
  profile_account_entitlements: ["profile_account_id", "product_key", "status"],
  marketplace_transactions: ["marketplace_reference", "metadata"],
  bidrock_listings: ["public_id", "inventory_position_id", "version"],
  bidrock_orders: ["public_id", "listing_public_id", "inventory_effect_status", "version"],
  bidrock_inventory_allocations: ["inventory_position_id", "status", "version"],
  bidrock_handoffs: ["evidence", "request_fingerprint", "idempotency_history", "version"],
  bidrock_order_delegations: ["order_id", "handoff_types", "status", "version"],
};

const REQUIRED_CONSTRAINTS = [
  ["profile_accounts", "profile_accounts_source_path_safe_check", "profile_accounts"],
  [
    "stone_inventory_positions",
    "stone_inventory_positions_passport_holder_unique",
    "stone_inventory",
  ],
  ["stone_inventory_positions", "stone_inventory_positions_quantity_hold_check", "stone_inventory"],
  ["bidrock_listings", "bidrock_listings_public_id_format_check", "bidrock"],
  ["bidrock_orders", "bidrock_orders_listing_public_id_format_check", "bidrock"],
  ["bidrock_orders", "bidrock_orders_public_id_format_check", "bidrock"],
  ["bidrock_orders", "bidrock_orders_inventory_effect_status_check", "bidrock"],
] as const;

const REQUIRED_UNIQUE_INDEXES = [
  ["idx_stone_materials_source_slug_unique", "stone_inventory"],
  ["idx_stone_asset_passports_public_id_unique", "stone_inventory"],
  ["stone_inventory_positions_passport_holder_unique", "stone_inventory"],
  ["idx_bidrock_listings_public_id_unique", "bidrock"],
  ["idx_bidrock_listings_inventory_position_unique", "bidrock"],
  ["idx_bidrock_listings_passport_unique", "bidrock"],
  ["idx_bidrock_orders_public_id_unique", "bidrock"],
  ["idx_bidrock_orders_marketplace_listing_unique", "bidrock"],
  ["idx_bidrock_orders_marketplace_transaction_unique", "bidrock"],
  ["idx_bidrock_orders_procurement_order_unique", "bidrock"],
  ["idx_bidrock_handoffs_order_type_unique", "bidrock"],
] as const;

const REQUIRED_TRIGGERS = [
  ["stone_asset_passports", "stone_asset_passports_material_identity_trigger", "stone_inventory"],
  ["profile_accounts", "profile_accounts_identity_trigger", "profile_accounts"],
  ["marketplace_transactions", "marketplace_transactions_bidrock_provenance_trigger", "bidrock"],
  ["bidrock_listings", "bidrock_listings_immutable_links_trigger", "bidrock"],
  ["bidrock_orders", "bidrock_orders_immutable_links_trigger", "bidrock"],
  ["bidrock_handoffs", "bidrock_handoffs_lifecycle_trigger", "bidrock"],
] as const;

export type CriticalSchemaScope = "stone_inventory" | "profile_accounts" | "bidrock";

const criticalSchemaReadiness: Record<CriticalSchemaScope, boolean> = {
  stone_inventory: false,
  profile_accounts: false,
  bidrock: false,
};

export function isCriticalSchemaReady(scope: CriticalSchemaScope): boolean {
  return criticalSchemaReadiness[scope];
}

export function requireCriticalSchema(scope: CriticalSchemaScope) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!criticalSchemaReadiness[scope]) {
      const label =
        scope === "bidrock"
          ? "BidRock"
          : scope === "stone_inventory"
            ? "Stone inventory"
            : "Profile account";
      res.status(503).json({
        message: `${label} is unavailable until its ordered database migrations and integrity guards are ready.`,
      });
      return;
    }
    next();
  };
}

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) as exists`,
      [table, column]
    );
    return Boolean(result.rows[0]?.exists);
  } catch (err) {
    console.error("[SchemaPreflight] Failed checking column", { table, column, error: err });
    return false;
  }
}

async function tableHasConstraint(table: string, constraint: string): Promise<boolean> {
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM pg_constraint
          WHERE conrelid = to_regclass('public.' || $1)
            AND conname = $2
            AND convalidated = TRUE
       ) AS exists`,
      [table, constraint]
    );
    return Boolean(result.rows[0]?.exists);
  } catch (err) {
    console.error("[SchemaPreflight] Failed checking constraint", {
      table,
      constraint,
      error: err,
    });
    return false;
  }
}

async function uniqueIndexIsReady(indexName: string): Promise<boolean> {
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM pg_index index_record
           INNER JOIN pg_class index_class ON index_class.oid = index_record.indexrelid
           INNER JOIN pg_namespace namespace ON namespace.oid = index_class.relnamespace
          WHERE namespace.nspname = 'public'
            AND index_class.relname = $1
            AND index_record.indisunique = TRUE
            AND index_record.indisvalid = TRUE
            AND index_record.indisready = TRUE
       ) AS exists`,
      [indexName]
    );
    return Boolean(result.rows[0]?.exists);
  } catch (err) {
    console.error("[SchemaPreflight] Failed checking unique index", { indexName, error: err });
    return false;
  }
}

async function triggerIsEnabled(table: string, triggerName: string): Promise<boolean> {
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM pg_trigger trigger_record
          WHERE trigger_record.tgrelid = to_regclass('public.' || $1)
            AND trigger_record.tgname = $2
            AND trigger_record.tgisinternal = FALSE
            AND trigger_record.tgenabled IN ('O', 'A')
       ) AS exists`,
      [table, triggerName]
    );
    return Boolean(result.rows[0]?.exists);
  } catch (err) {
    console.error("[SchemaPreflight] Failed checking trigger", { table, triggerName, error: err });
    return false;
  }
}

function criticalScopeForTable(table: string): CriticalSchemaScope {
  if (table === "profile_accounts" || table === "profile_account_entitlements") {
    return "profile_accounts";
  }
  if (table.startsWith("stone_")) return "stone_inventory";
  return "bidrock";
}

export async function runSchemaPreflight(): Promise<void> {
  const issues: DriftIssue[] = [];
  criticalSchemaReadiness.stone_inventory = false;
  criticalSchemaReadiness.profile_accounts = false;
  criticalSchemaReadiness.bidrock = false;

  for (const column of EXPECTED_USER_COLUMNS) {
    const exists = await tableHasColumn("users", column);
    if (!exists) {
      issues.push({
        scope: "users",
        code: `missing_column:${column}`,
        message: `Expected column users.${column} is missing. Run migrations (e.g. drizzle-kit push) against this database.`,
        severity: "error",
      });
    }
  }

  for (const column of EXPECTED_BUSINESS_COLUMNS) {
    const exists = await tableHasColumn("businesses", column);
    if (!exists) {
      issues.push({
        scope: "businesses",
        code: `missing_column:${column}`,
        message: `Expected column businesses.${column} is missing. Run migrations (e.g. npm run db:migrate) against this database.`,
        severity: "error",
      });
    }
  }

  for (const [table, columns] of Object.entries(EXPECTED_MARKETPLACE_SCHEMA)) {
    for (const column of columns) {
      const exists = await tableHasColumn(table, column);
      if (!exists) {
        issues.push({
          scope: table,
          code: `missing_column:${column}`,
          message: `Expected column ${table}.${column} is missing. Apply ordered migrations 0116-0118 before serving Stone Core, profile-account, or BidRock traffic.`,
          severity: "error",
        });
      }
    }
  }

  for (const [table, constraint, scope] of REQUIRED_CONSTRAINTS) {
    if (!(await tableHasConstraint(table, constraint))) {
      issues.push({
        scope,
        code: `constraint_not_validated:${constraint}`,
        message: `Required validated constraint ${constraint} is missing or not validated.`,
        severity: "error",
      });
    }
  }

  for (const [indexName, scope] of REQUIRED_UNIQUE_INDEXES) {
    if (!(await uniqueIndexIsReady(indexName))) {
      issues.push({
        scope,
        code: `unique_index_not_ready:${indexName}`,
        message: `Required unique index ${indexName} is missing, invalid, or not ready.`,
        severity: "error",
      });
    }
  }

  for (const [table, triggerName, scope] of REQUIRED_TRIGGERS) {
    if (!(await triggerIsEnabled(table, triggerName))) {
      issues.push({
        scope,
        code: `trigger_not_enabled:${triggerName}`,
        message: `Required integrity trigger ${triggerName} is missing or disabled.`,
        severity: "error",
      });
    }
  }

  const missingScopes = new Set(issues.map((issue) => issue.scope));
  for (const table of Object.keys(EXPECTED_MARKETPLACE_SCHEMA)) {
    if (missingScopes.has(table)) missingScopes.add(criticalScopeForTable(table));
  }
  criticalSchemaReadiness.stone_inventory = !missingScopes.has("stone_inventory");
  criticalSchemaReadiness.profile_accounts = !missingScopes.has("profile_accounts");
  criticalSchemaReadiness.bidrock =
    criticalSchemaReadiness.stone_inventory &&
    criticalSchemaReadiness.profile_accounts &&
    !missingScopes.has("bidrock");

  if (issues.length === 0) {
    console.log("[SchemaPreflight] OK - no drift detected for critical tables.");
    return;
  }

  console.warn("[SchemaPreflight] Detected potential schema drift:");
  for (const issue of issues) {
    console.warn(
      " -",
      JSON.stringify({
        scope: issue.scope,
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
      })
    );
  }
}
