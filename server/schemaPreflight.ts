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
  bidrock_auctions: [
    "public_id",
    "lot_number",
    "listing_id",
    "status",
    "opening_bid_cents",
    "reserve_bid_cents",
    "minimum_increment_cents",
    "currency",
    "starts_at",
    "ends_at",
    "original_ends_at",
    "soft_close_seconds",
    "pickup_terms",
    "freight_terms",
    "configured_by_user_id",
    "winner_bid_id",
    "reservation_id",
    "order_id",
    "closed_at",
    "version",
  ],
  bidrock_bids: [
    "accepted_sequence",
    "auction_id",
    "bidder_user_id",
    "bidder_business_profile_id",
    "max_amount_cents",
    "currency",
    "idempotency_key",
    "request_fingerprint",
  ],
  bidrock_reservations: ["auction_id", "winning_bid_id", "version"],
  bidrock_orders: [
    "public_id",
    "listing_public_id",
    "auction_id",
    "winning_bid_id",
    "inventory_effect_status",
    "version",
  ],
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
  ["bidrock_auctions", "bidrock_auctions_public_id_format_check", "bidrock"],
  ["bidrock_auctions", "bidrock_auctions_lot_number_format_check", "bidrock"],
  ["bidrock_auctions", "bidrock_auctions_status_check", "bidrock"],
  ["bidrock_auctions", "bidrock_auctions_positive_values_check", "bidrock"],
  ["bidrock_auctions", "bidrock_auctions_time_order_check", "bidrock"],
  ["bidrock_auctions", "bidrock_auctions_soft_close_check", "bidrock"],
  ["bidrock_auctions", "bidrock_auctions_terms_check", "bidrock"],
  ["bidrock_auctions", "bidrock_auctions_currency_check", "bidrock"],
  ["bidrock_auctions", "bidrock_auctions_close_outcome_check", "bidrock"],
  ["bidrock_bids", "bidrock_bids_positive_max_check", "bidrock"],
  ["bidrock_bids", "bidrock_bids_currency_check", "bidrock"],
  ["bidrock_bids", "bidrock_bids_idempotency_key_check", "bidrock"],
  ["bidrock_reservations", "bidrock_reservations_origin_check", "bidrock"],
  ["bidrock_orders", "bidrock_orders_origin_check", "bidrock"],
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
  ["idx_bidrock_auctions_public_id_unique", "bidrock"],
  ["idx_bidrock_auctions_lot_number_unique", "bidrock"],
  ["idx_bidrock_auctions_one_current_per_listing", "bidrock"],
  ["idx_bidrock_bids_accepted_sequence_unique", "bidrock"],
  ["idx_bidrock_bids_idempotency_unique", "bidrock"],
  ["idx_bidrock_reservations_auction_unique", "bidrock"],
  ["idx_bidrock_reservations_winning_bid_unique", "bidrock"],
  ["idx_bidrock_orders_auction_unique", "bidrock"],
  ["idx_bidrock_orders_winning_bid_unique", "bidrock"],
  ["idx_bidrock_auctions_winner_bid_unique", "bidrock"],
  ["idx_bidrock_auctions_reservation_unique", "bidrock"],
  ["idx_bidrock_auctions_order_unique", "bidrock"],
] as const;

type RequiredUniqueIndexShape = Readonly<{
  table: string;
  name: string;
  columns: readonly string[];
  normalizedPredicate: string;
}>;

const REQUIRED_AUCTION_UNIQUE_INDEX_SHAPES: readonly RequiredUniqueIndexShape[] = [
  {
    table: "bidrock_auctions",
    name: "idx_bidrock_auctions_public_id_unique",
    columns: ["public_id"],
    normalizedPredicate: "",
  },
  {
    table: "bidrock_auctions",
    name: "idx_bidrock_auctions_lot_number_unique",
    columns: ["lot_number"],
    normalizedPredicate: "",
  },
  {
    table: "bidrock_auctions",
    name: "idx_bidrock_auctions_one_current_per_listing",
    columns: ["listing_id"],
    normalizedPredicate:
      "status=anyarray['scheduled'::text,'live'::text,'extended'::text,'ended'::text]",
  },
  {
    table: "bidrock_bids",
    name: "idx_bidrock_bids_accepted_sequence_unique",
    columns: ["accepted_sequence"],
    normalizedPredicate: "",
  },
  {
    table: "bidrock_bids",
    name: "idx_bidrock_bids_idempotency_unique",
    columns: ["auction_id", "bidder_user_id", "idempotency_key"],
    normalizedPredicate: "",
  },
  ...[
    ["bidrock_reservations", "idx_bidrock_reservations_auction_unique", "auction_id"],
    ["bidrock_reservations", "idx_bidrock_reservations_winning_bid_unique", "winning_bid_id"],
    ["bidrock_orders", "idx_bidrock_orders_auction_unique", "auction_id"],
    ["bidrock_orders", "idx_bidrock_orders_winning_bid_unique", "winning_bid_id"],
    ["bidrock_auctions", "idx_bidrock_auctions_winner_bid_unique", "winner_bid_id"],
    ["bidrock_auctions", "idx_bidrock_auctions_reservation_unique", "reservation_id"],
    ["bidrock_auctions", "idx_bidrock_auctions_order_unique", "order_id"],
  ].map(([table, name, column]) => ({
    table,
    name,
    columns: [column],
    normalizedPredicate: `${column}isnotnull`,
  })),
];

type RequiredForeignKey = Readonly<{
  table: string;
  name: string;
  columns: readonly string[];
  referencedTable: string;
  referencedColumns: readonly string[];
}>;

const REQUIRED_AUCTION_FOREIGN_KEYS: readonly RequiredForeignKey[] = [
  {
    table: "bidrock_auctions",
    name: "bidrock_auctions_listing_id_fkey",
    columns: ["listing_id"],
    referencedTable: "bidrock_listings",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_auctions",
    name: "bidrock_auctions_configured_by_user_id_fkey",
    columns: ["configured_by_user_id"],
    referencedTable: "users",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_bids",
    name: "bidrock_bids_auction_id_fkey",
    columns: ["auction_id"],
    referencedTable: "bidrock_auctions",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_bids",
    name: "bidrock_bids_bidder_user_id_fkey",
    columns: ["bidder_user_id"],
    referencedTable: "users",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_bids",
    name: "bidrock_bids_bidder_business_profile_id_fkey",
    columns: ["bidder_business_profile_id"],
    referencedTable: "user_profiles",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_reservations",
    name: "bidrock_reservations_auction_fk",
    columns: ["auction_id"],
    referencedTable: "bidrock_auctions",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_reservations",
    name: "bidrock_reservations_winning_bid_fk",
    columns: ["winning_bid_id"],
    referencedTable: "bidrock_bids",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_orders",
    name: "bidrock_orders_auction_fk",
    columns: ["auction_id"],
    referencedTable: "bidrock_auctions",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_orders",
    name: "bidrock_orders_winning_bid_fk",
    columns: ["winning_bid_id"],
    referencedTable: "bidrock_bids",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_auctions",
    name: "bidrock_auctions_winner_bid_fk",
    columns: ["winner_bid_id"],
    referencedTable: "bidrock_bids",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_auctions",
    name: "bidrock_auctions_reservation_fk",
    columns: ["reservation_id"],
    referencedTable: "bidrock_reservations",
    referencedColumns: ["id"],
  },
  {
    table: "bidrock_auctions",
    name: "bidrock_auctions_order_fk",
    columns: ["order_id"],
    referencedTable: "bidrock_orders",
    referencedColumns: ["id"],
  },
];

const REQUIRED_NULLABLE_AUCTION_ORIGIN_COLUMNS = [
  ["bidrock_reservations", "accepted_offer_id"],
  ["bidrock_orders", "accepted_offer_id"],
] as const;

const REQUIRED_TRIGGERS = [
  ["stone_asset_passports", "stone_asset_passports_material_identity_trigger", "stone_inventory"],
  ["profile_accounts", "profile_accounts_identity_trigger", "profile_accounts"],
  ["marketplace_transactions", "marketplace_transactions_bidrock_provenance_trigger", "bidrock"],
  ["bidrock_listings", "bidrock_listings_immutable_links_trigger", "bidrock"],
  ["bidrock_orders", "bidrock_orders_immutable_links_trigger", "bidrock"],
  ["bidrock_handoffs", "bidrock_handoffs_lifecycle_trigger", "bidrock"],
  ["bidrock_auctions", "bidrock_auctions_immutable_identity_trigger", "bidrock"],
  ["bidrock_bids", "bidrock_bids_immutable_update_trigger", "bidrock"],
  ["bidrock_bids", "bidrock_bids_immutable_delete_trigger", "bidrock"],
  ["bidrock_reservations", "bidrock_reservations_immutable_origin_trigger", "bidrock"],
  ["bidrock_orders", "bidrock_orders_immutable_origin_trigger", "bidrock"],
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

async function uniqueIndexMatchesShape(requirement: RequiredUniqueIndexShape): Promise<boolean> {
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM pg_index index_record
           INNER JOIN pg_class index_class ON index_class.oid = index_record.indexrelid
           INNER JOIN pg_namespace namespace ON namespace.oid = index_class.relnamespace
          WHERE namespace.nspname = 'public'
            AND index_class.relname = $1
            AND index_record.indrelid = to_regclass('public.' || $2)
            AND index_record.indisunique = TRUE
            AND index_record.indisvalid = TRUE
            AND index_record.indisready = TRUE
            AND ARRAY(
                  SELECT attribute.attname::text
                    FROM unnest(index_record.indkey::smallint[]) WITH ORDINALITY
                         AS key_column(attribute_number, position)
                    INNER JOIN pg_attribute attribute
                      ON attribute.attrelid = index_record.indrelid
                     AND attribute.attnum = key_column.attribute_number
                   WHERE key_column.position <= index_record.indnkeyatts
                   ORDER BY key_column.position
                ) = $3::text[]
            AND CASE
                  WHEN $4::text = '' THEN index_record.indpred IS NULL
                  ELSE regexp_replace(
                         lower(pg_get_expr(index_record.indpred, index_record.indrelid)),
                         '[[:space:]()]', '', 'g'
                       ) = $4::text
                END
       ) AS exists`,
      [
        requirement.name,
        requirement.table,
        [...requirement.columns],
        requirement.normalizedPredicate,
      ]
    );
    return Boolean(result.rows[0]?.exists);
  } catch (err) {
    console.error("[SchemaPreflight] Failed checking unique index shape", {
      requirement,
      error: err,
    });
    return false;
  }
}

async function foreignKeyMatchesShape(requirement: RequiredForeignKey): Promise<boolean> {
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM pg_constraint constraint_record
          WHERE constraint_record.conrelid = to_regclass('public.' || $1)
            AND constraint_record.conname = $2
            AND constraint_record.contype = 'f'
            AND constraint_record.convalidated = TRUE
            AND constraint_record.confrelid = to_regclass('public.' || $3)
            AND constraint_record.confdeltype = 'r'
            AND ARRAY(
                  SELECT attribute.attname::text
                    FROM unnest(constraint_record.conkey) WITH ORDINALITY
                         AS key_column(attribute_number, position)
                    INNER JOIN pg_attribute attribute
                      ON attribute.attrelid = constraint_record.conrelid
                     AND attribute.attnum = key_column.attribute_number
                   ORDER BY key_column.position
                ) = $4::text[]
            AND ARRAY(
                  SELECT attribute.attname::text
                    FROM unnest(constraint_record.confkey) WITH ORDINALITY
                         AS key_column(attribute_number, position)
                    INNER JOIN pg_attribute attribute
                      ON attribute.attrelid = constraint_record.confrelid
                     AND attribute.attnum = key_column.attribute_number
                   ORDER BY key_column.position
                ) = $5::text[]
       ) AS exists`,
      [
        requirement.table,
        requirement.name,
        requirement.referencedTable,
        [...requirement.columns],
        [...requirement.referencedColumns],
      ]
    );
    return Boolean(result.rows[0]?.exists);
  } catch (err) {
    console.error("[SchemaPreflight] Failed checking foreign key shape", {
      requirement,
      error: err,
    });
    return false;
  }
}

async function columnAllowsNull(table: string, column: string): Promise<boolean> {
  try {
    const result = await pool.query<{ allows_null: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
            AND is_nullable = 'YES'
       ) AS allows_null`,
      [table, column]
    );
    return Boolean(result.rows[0]?.allows_null);
  } catch (err) {
    console.error("[SchemaPreflight] Failed checking column nullability", {
      table,
      column,
      error: err,
    });
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
          message: `Expected column ${table}.${column} is missing. Apply ordered migrations 0116-0119 before serving Stone Core, profile-account, or BidRock traffic.`,
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

  for (const requirement of REQUIRED_AUCTION_UNIQUE_INDEX_SHAPES) {
    if (!(await uniqueIndexMatchesShape(requirement))) {
      issues.push({
        scope: "bidrock",
        code: `unique_index_shape_mismatch:${requirement.name}`,
        message: `Required unique index ${requirement.name} does not match its canonical table, columns, or predicate.`,
        severity: "error",
      });
    }
  }

  for (const requirement of REQUIRED_AUCTION_FOREIGN_KEYS) {
    if (!(await foreignKeyMatchesShape(requirement))) {
      issues.push({
        scope: "bidrock",
        code: `foreign_key_shape_mismatch:${requirement.name}`,
        message: `Required foreign key ${requirement.name} is missing, unvalidated, or points to the wrong columns.`,
        severity: "error",
      });
    }
  }

  for (const [table, column] of REQUIRED_NULLABLE_AUCTION_ORIGIN_COLUMNS) {
    if (!(await columnAllowsNull(table, column))) {
      issues.push({
        scope: "bidrock",
        code: `column_not_nullable:${table}.${column}`,
        message: `Auction-origin compatibility requires ${table}.${column} to allow NULL.`,
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
