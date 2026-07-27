import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Client } = pg;
export const REQUIRED_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0072_seo_publication_rules_and_freshness.sql"
);
export const REQUIRED_MIGRATION_HASH = crypto
  .createHash("sha256")
  .update(fs.readFileSync(REQUIRED_MIGRATION_PATH, "utf8"))
  .digest("hex");
export const AUTH_ACTION_TOKEN_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0109_auth_action_tokens.sql"
);
export const AUTH_ACTION_TOKEN_MIGRATION_HASH = crypto
  .createHash("sha256")
  .update(fs.readFileSync(AUTH_ACTION_TOKEN_MIGRATION_PATH, "utf8"))
  .digest("hex");
export const ASSIGNMENT_PROVIDER_KEY_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0110_work_request_assignment_provider_key.sql"
);
export const ASSIGNMENT_PROVIDER_KEY_MIGRATION_HASH = crypto
  .createHash("sha256")
  .update(fs.readFileSync(ASSIGNMENT_PROVIDER_KEY_MIGRATION_PATH, "utf8"))
  .digest("hex");
export const NOTIFICATION_DELIVERY_OUTBOX_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0111_notification_delivery_outbox_guard.sql"
);
export const NOTIFICATION_DELIVERY_OUTBOX_MIGRATION_HASH = crypto
  .createHash("sha256")
  .update(fs.readFileSync(NOTIFICATION_DELIVERY_OUTBOX_MIGRATION_PATH, "utf8"))
  .digest("hex");
export const NOTIFICATION_DELIVERY_CLAIM_OWNERSHIP_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0112_notification_delivery_claim_ownership.sql"
);
export const NOTIFICATION_DELIVERY_CLAIM_OWNERSHIP_MIGRATION_HASH = crypto
  .createHash("sha256")
  .update(fs.readFileSync(NOTIFICATION_DELIVERY_CLAIM_OWNERSHIP_MIGRATION_PATH, "utf8"))
  .digest("hex");
export const DIRECT_CONNECT_RESPONSE_BINDING_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0113_direct_connect_response_assignment_binding.sql"
);
export const DIRECT_CONNECT_RESPONSE_BINDING_MIGRATION_HASH = crypto
  .createHash("sha256")
  .update(fs.readFileSync(DIRECT_CONNECT_RESPONSE_BINDING_MIGRATION_PATH, "utf8"))
  .digest("hex");
export const DIRECT_CONNECT_CONTACT_GATE_BINDING_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0114_direct_connect_contact_gate_binding.sql"
);
export const DIRECT_CONNECT_CONTACT_GATE_BINDING_MIGRATION_HASH = crypto
  .createHash("sha256")
  .update(fs.readFileSync(DIRECT_CONNECT_CONTACT_GATE_BINDING_MIGRATION_PATH, "utf8"))
  .digest("hex");
export const DIRECT_CONNECT_LEDGER_FOUNDATION_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0115_direct_connect_ledger_foundation.sql"
);
export const DIRECT_CONNECT_LEDGER_FOUNDATION_MIGRATION_HASH = crypto
  .createHash("sha256")
  .update(fs.readFileSync(DIRECT_CONNECT_LEDGER_FOUNDATION_MIGRATION_PATH, "utf8"))
  .digest("hex");

export function evaluateRequiredProductionSchema(check) {
  const missing = [];
  if (!check.migrationLedger) {
    missing.push("drizzle.__drizzle_migrations");
  } else {
    if (!check.migrationRecorded) {
      missing.push("drizzle.__drizzle_migrations[0072 canonical hash]");
    }
    if (!check.authActionMigrationRecorded) {
      missing.push("drizzle.__drizzle_migrations[0109 canonical hash]");
    }
    if (!check.assignmentProviderKeyMigrationRecorded) {
      missing.push("drizzle.__drizzle_migrations[0110 canonical hash]");
    }
    if (!check.notificationDeliveryOutboxMigrationRecorded) {
      missing.push("drizzle.__drizzle_migrations[0111 canonical hash]");
    }
    if (!check.notificationDeliveryClaimOwnershipMigrationRecorded) {
      missing.push("drizzle.__drizzle_migrations[0112 canonical hash]");
    }
    if (!check.directConnectResponseBindingMigrationRecorded) {
      missing.push("drizzle.__drizzle_migrations[0113 canonical hash]");
    }
    if (!check.directConnectContactGateBindingMigrationRecorded) {
      missing.push("drizzle.__drizzle_migrations[0114 canonical hash]");
    }
    if (!check.directConnectLedgerFoundationMigrationRecorded) {
      missing.push("drizzle.__drizzle_migrations[0115 canonical hash]");
    }
  }
  if (!check.publicationRules) missing.push("ts_publication_rules");
  if (!check.seoPruneLog) missing.push("ts_seo_prune_log");
  if (!check.publicActivity) missing.push("ts_public_activity");
  if (!check.authActionTokens) missing.push("auth_action_tokens");
  if (check.authActionTokens && !check.authActionTokenColumnShape) {
    missing.push("auth_action_tokens[required column types/nullability]");
  }
  if (check.authActionTokens && !check.authActionTokenConstraints) {
    missing.push("auth_action_tokens[primary/foreign-key constraints]");
  }
  if (check.authActionTokens && !check.authActionTokenUniqueIndexes) {
    missing.push("auth_action_tokens[valid unique indexes]");
  }
  if (!check.assignmentProviderKey) {
    missing.push("work_request_assignments.provider_key");
  }
  if (!check.assignmentProviderKeyUnique || !check.assignmentProviderKeyUniqueDefinition) {
    missing.push("work_request_assignments_request_provider_key_unique");
  }
  if (!check.notificationDeliveryLog) {
    missing.push("notification_delivery_log");
  } else {
    if (!check.notificationDeliveryLogColumns) {
      missing.push("notification_delivery_log[required outbox columns]");
    }
    if (!check.notificationDeliveryLogColumnShape) {
      missing.push("notification_delivery_log[required column types/nullability]");
    }
    if (!check.notificationDeliveryLogConstraints) {
      missing.push("notification_delivery_log[primary/foreign-key constraints]");
    }
  }
  if (
    !check.notificationDeliveryDueWorkIndex ||
    !check.notificationDeliveryDueWorkIndexDefinition
  ) {
    missing.push("idx_notification_delivery_email_due_work");
  }
  if (!check.directConnectResponseBindingColumns) {
    missing.push("direct_connect_contractor_responses[assignment/provider binding columns]");
  }
  if (!check.directConnectResponseBindingIndex) {
    missing.push("idx_dc_contractor_responses_assignment_binding");
  }
  if (!check.directConnectContactGateBindingColumns) {
    missing.push("direct_connect_dispatch_requests[contact gate binding columns]");
  }
  if (!check.directConnectLedgerFoundationTables) {
    missing.push("direct_connect_ledger_foundation[canonical tables]");
  }
  if (!check.directConnectNotificationsIdempotencyIndex) {
    missing.push("direct_connect_notifications_idempotency_idx");
  }
  if (!check.directConnectBindingRepairQuarantine) {
    missing.push("direct_connect_binding_repair_quarantine");
  } else if (!check.directConnectBindingRepairReady) {
    missing.push("direct_connect_binding_repair_quarantine[unresolved exact bindings]");
  }
  if (!check.directConnectExactBindingViolations) {
    missing.push("direct_connect_exact_binding_violations");
  } else if (!check.directConnectExactBindingReady) {
    missing.push("direct_connect_exact_binding_violations[unresolved exact bindings]");
  }
  if (!check.publicDiscoveryEnabled) missing.push("businesses.public_discovery_enabled");
  if (check.publicationRules && !check.defaultPublicationRule) {
    missing.push("ts_publication_rules[id=default]");
  }
  return missing;
}

export async function verifyRequiredProductionSchema(client) {
  const schemaResult = await client.query(`
    select
      to_regclass('public.ts_publication_rules') is not null as publication_rules,
      to_regclass('public.ts_seo_prune_log') is not null as seo_prune_log,
      to_regclass('public.ts_public_activity') is not null as public_activity,
      (
        to_regclass('public.auth_action_tokens') is not null
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'auth_action_tokens'
            AND column_name = 'scope_key'
        )
      ) as auth_action_tokens,
      NOT EXISTS (
        SELECT 1
        FROM (
          VALUES
            ('id', 'character varying', true),
            ('user_id', 'character varying', true),
            ('purpose', 'character varying(32)', true),
            ('scope_key', 'character varying(255)', false),
            ('token_hash', 'character varying(64)', true),
            ('code_hash', 'character varying(64)', false),
            ('expires_at', 'timestamp with time zone', true),
            ('consumed_at', 'timestamp with time zone', false),
            ('revoked_at', 'timestamp with time zone', false),
            ('created_at', 'timestamp with time zone', true)
        ) AS required(column_name, formatted_type, is_not_null)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_attribute attribute
          INNER JOIN pg_class table_row ON table_row.oid = attribute.attrelid
          INNER JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
          WHERE namespace_row.nspname = 'public'
            AND table_row.relname = 'auth_action_tokens'
            AND attribute.attname = required.column_name
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND format_type(attribute.atttypid, attribute.atttypmod) = required.formatted_type
            AND attribute.attnotnull = required.is_not_null
        )
      ) as auth_action_token_column_shape,
      (
        EXISTS (
          SELECT 1
          FROM pg_constraint constraint_row
          WHERE constraint_row.conrelid = to_regclass('public.auth_action_tokens')
            AND constraint_row.contype = 'p'
            AND constraint_row.convalidated
            AND pg_get_constraintdef(constraint_row.oid) = 'PRIMARY KEY (id)'
        )
        AND EXISTS (
          SELECT 1
          FROM pg_constraint constraint_row
          WHERE constraint_row.conrelid = to_regclass('public.auth_action_tokens')
            AND constraint_row.contype = 'f'
            AND constraint_row.convalidated
            AND constraint_row.confrelid = to_regclass('public.users')
            AND constraint_row.confdeltype = 'c'
            AND pg_get_constraintdef(constraint_row.oid)
              LIKE 'FOREIGN KEY (user_id) REFERENCES users(id)%'
        )
      ) as auth_action_token_constraints,
      (
        EXISTS (
          SELECT 1
          FROM pg_index index_row
          INNER JOIN pg_class index_class ON index_class.oid = index_row.indexrelid
          WHERE index_class.relname = 'auth_action_tokens_token_hash_unique'
            AND index_row.indrelid = to_regclass('public.auth_action_tokens')
            AND index_row.indisunique
            AND index_row.indisvalid
            AND index_row.indisready
            AND index_row.indnkeyatts = 1
            AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'token_hash'
            AND index_row.indpred IS NULL
        )
        AND EXISTS (
          SELECT 1
          FROM pg_index index_row
          INNER JOIN pg_class index_class ON index_class.oid = index_row.indexrelid
          WHERE index_class.relname = 'auth_action_tokens_one_active_per_user_purpose'
            AND index_row.indrelid = to_regclass('public.auth_action_tokens')
            AND index_row.indisunique
            AND index_row.indisvalid
            AND index_row.indisready
            AND index_row.indnkeyatts = 3
            AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'user_id'
            AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'purpose'
            AND pg_get_indexdef(index_row.indexrelid, 3, true) LIKE 'COALESCE(scope_key,%'
            AND pg_get_expr(index_row.indpred, index_row.indrelid) LIKE '%consumed_at IS NULL%'
            AND pg_get_expr(index_row.indpred, index_row.indrelid) LIKE '%revoked_at IS NULL%'
        )
      ) as auth_action_token_unique_indexes,
      to_regclass('public.notification_delivery_log') is not null
        as notification_delivery_log,
      to_regclass('drizzle.__drizzle_migrations') is not null as migration_ledger,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'businesses'
          and column_name = 'public_discovery_enabled'
      ) as public_discovery_enabled,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'work_request_assignments'
          and column_name = 'provider_key'
      ) as assignment_provider_key,
      to_regclass(
        'public.work_request_assignments_request_provider_key_unique'
      ) is not null as assignment_provider_key_unique,
      EXISTS (
        SELECT 1
        FROM pg_index index_row
        INNER JOIN pg_class index_class ON index_class.oid = index_row.indexrelid
        WHERE index_class.relname = 'work_request_assignments_request_provider_key_unique'
          AND index_row.indrelid = to_regclass('public.work_request_assignments')
          AND index_row.indisunique
          AND index_row.indisvalid
          AND index_row.indisready
          AND index_row.indnkeyatts = 2
          AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'work_request_id'
          AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'provider_key'
          AND pg_get_expr(index_row.indpred, index_row.indrelid)
            LIKE '%provider_key IS NOT NULL%'
      ) as assignment_provider_key_unique_definition,
      NOT EXISTS (
        SELECT required.column_name
        FROM unnest(ARRAY['assignment_id', 'provider_key']::text[]) AS required(column_name)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_attribute attribute
          INNER JOIN pg_class table_row ON table_row.oid = attribute.attrelid
          INNER JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
          WHERE namespace_row.nspname = 'public'
            AND table_row.relname = 'direct_connect_contractor_responses'
            AND attribute.attname = required.column_name
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND format_type(attribute.atttypid, attribute.atttypmod) = 'text'
            AND NOT attribute.attnotnull
        )
      ) as direct_connect_response_binding_columns,
      EXISTS (
        SELECT 1
        FROM pg_index index_row
        INNER JOIN pg_class index_class ON index_class.oid = index_row.indexrelid
        WHERE index_class.relname = 'idx_dc_contractor_responses_assignment_binding'
          AND index_row.indrelid = to_regclass('public.direct_connect_contractor_responses')
          AND index_row.indisvalid
          AND index_row.indisready
          AND index_row.indnkeyatts = 4
          AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'request_id'
          AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'assignment_id'
          AND pg_get_indexdef(index_row.indexrelid, 3, true) = 'provider_key'
          AND pg_get_indexdef(index_row.indexrelid, 4, true) = 'created_at'
          AND pg_get_indexdef(index_row.indexrelid) LIKE '%created_at DESC%'
          AND pg_get_expr(index_row.indpred, index_row.indrelid)
            LIKE '%assignment_id IS NOT NULL%'
          AND pg_get_expr(index_row.indpred, index_row.indrelid)
            LIKE '%provider_key IS NOT NULL%'
      ) as direct_connect_response_binding_index,
      NOT EXISTS (
        SELECT required.column_name
        FROM unnest(
          ARRAY['contact_gate_assignment_id', 'contact_gate_provider_key']::text[]
        ) AS required(column_name)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_attribute attribute
          INNER JOIN pg_class table_row ON table_row.oid = attribute.attrelid
          INNER JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
          WHERE namespace_row.nspname = 'public'
            AND table_row.relname = 'direct_connect_dispatch_requests'
            AND attribute.attname = required.column_name
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND format_type(attribute.atttypid, attribute.atttypmod) = 'text'
            AND NOT attribute.attnotnull
        )
      ) as direct_connect_contact_gate_binding_columns,
      NOT EXISTS (
        SELECT required.table_name
        FROM unnest(ARRAY[
          'direct_connect_dispatch_requests',
          'direct_connect_dispatch_candidates',
          'direct_connect_dispatch_events',
          'direct_connect_contractor_responses',
          'direct_connect_lifecycle_notifications',
          'direct_connect_job_workspaces',
          'direct_connect_notifications',
          'job_estimates',
          'job_estimate_line_items',
          'job_material_items',
          'job_labor_items',
          'job_acceptances',
          'job_payment_requests',
          'job_schedule_proposals',
          'job_payment_records',
          'job_checkpoints',
          'job_change_orders',
          'job_punch_list_items',
          'job_completion_requests',
          'job_invoices',
          'job_invoice_line_items',
          'job_receipts'
        ]::text[]) AS required(table_name)
        WHERE to_regclass(format('public.%I', required.table_name)) IS NULL
      ) as direct_connect_ledger_foundation_tables,
      EXISTS (
        SELECT 1
        FROM pg_index index_row
        INNER JOIN pg_class index_class ON index_class.oid = index_row.indexrelid
        WHERE index_class.relname = 'direct_connect_notifications_idempotency_idx'
          AND index_row.indrelid = to_regclass('public.direct_connect_notifications')
          AND index_row.indisunique
          AND index_row.indisvalid
          AND index_row.indisready
          AND index_row.indnkeyatts = 5
          AND pg_get_indexdef(index_row.indexrelid, 1, true)
            LIKE 'COALESCE(event_id,%'
          AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'recipient_role'
          AND pg_get_indexdef(index_row.indexrelid, 3, true)
            LIKE 'COALESCE(recipient_user_id,%'
          AND pg_get_indexdef(index_row.indexrelid, 4, true)
            LIKE 'COALESCE(recipient_business_id,%'
          AND pg_get_indexdef(index_row.indexrelid, 5, true) = 'notification_type'
          AND index_row.indpred IS NULL
      ) as direct_connect_notifications_idempotency_index,
      to_regclass('public.direct_connect_binding_repair_quarantine') is not null
        as direct_connect_binding_repair_quarantine,
      EXISTS (
        SELECT 1
        FROM pg_class view_row
        INNER JOIN pg_namespace namespace_row ON namespace_row.oid = view_row.relnamespace
        WHERE namespace_row.nspname = 'public'
          AND view_row.relname = 'direct_connect_exact_binding_violations'
          AND view_row.relkind = 'v'
      ) as direct_connect_exact_binding_violations,
      NOT EXISTS (
        SELECT 1
        FROM direct_connect_binding_repair_quarantine
        WHERE resolved_at IS NULL
      ) as direct_connect_binding_repair_ready,
      NOT EXISTS (
        SELECT required.column_name
        FROM unnest(ARRAY[
          'id',
          'notification_id',
          'user_id',
          'delivery_method',
          'status',
          'contact_info',
          'external_id',
          'external_response',
          'error_code',
          'error_message',
          'retry_count',
          'next_retry_at',
          'claim_token',
          'sent_at',
          'delivered_at',
          'failed_at',
          'created_at',
          'updated_at'
        ]::text[]) AS required(column_name)
        WHERE NOT EXISTS (
          SELECT 1
          FROM information_schema.columns actual
          WHERE actual.table_schema = 'public'
            AND actual.table_name = 'notification_delivery_log'
            AND actual.column_name = required.column_name
        )
      ) as notification_delivery_log_columns,
      NOT EXISTS (
        SELECT 1
        FROM (
          VALUES
            ('id', 'character varying', true),
            ('notification_id', 'character varying', true),
            ('user_id', 'character varying', true),
            ('delivery_method', 'delivery_method', true),
            ('status', 'character varying', true),
            ('contact_info', 'character varying', false),
            ('external_id', 'character varying', false),
            ('external_response', 'jsonb', false),
            ('error_code', 'character varying', false),
            ('error_message', 'text', false),
            ('retry_count', 'integer', false),
            ('next_retry_at', 'timestamp without time zone', false),
            ('claim_token', 'character varying', false),
            ('sent_at', 'timestamp without time zone', false),
            ('delivered_at', 'timestamp without time zone', false),
            ('failed_at', 'timestamp without time zone', false),
            ('created_at', 'timestamp without time zone', false),
            ('updated_at', 'timestamp without time zone', false)
        ) AS required(column_name, formatted_type, is_not_null)
        WHERE NOT EXISTS (
          SELECT 1
          FROM pg_attribute attribute
          INNER JOIN pg_class table_row ON table_row.oid = attribute.attrelid
          INNER JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
          WHERE namespace_row.nspname = 'public'
            AND table_row.relname = 'notification_delivery_log'
            AND attribute.attname = required.column_name
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND format_type(attribute.atttypid, attribute.atttypmod) = required.formatted_type
            AND attribute.attnotnull = required.is_not_null
        )
      ) as notification_delivery_log_column_shape,
      (
        EXISTS (
          SELECT 1
          FROM pg_constraint constraint_row
          WHERE constraint_row.conrelid = to_regclass('public.notification_delivery_log')
            AND constraint_row.contype = 'p'
            AND constraint_row.convalidated
            AND pg_get_constraintdef(constraint_row.oid) = 'PRIMARY KEY (id)'
        )
        AND EXISTS (
          SELECT 1
          FROM pg_constraint constraint_row
          WHERE constraint_row.conrelid = to_regclass('public.notification_delivery_log')
            AND constraint_row.contype = 'f'
            AND constraint_row.convalidated
            AND constraint_row.confrelid = to_regclass('public.notifications')
            AND constraint_row.confdeltype = 'c'
            AND pg_get_constraintdef(constraint_row.oid)
              LIKE 'FOREIGN KEY (notification_id) REFERENCES notifications(id)%'
        )
        AND EXISTS (
          SELECT 1
          FROM pg_constraint constraint_row
          WHERE constraint_row.conrelid = to_regclass('public.notification_delivery_log')
            AND constraint_row.contype = 'f'
            AND constraint_row.convalidated
            AND constraint_row.confrelid = to_regclass('public.users')
            AND constraint_row.confdeltype = 'c'
            AND pg_get_constraintdef(constraint_row.oid)
              LIKE 'FOREIGN KEY (user_id) REFERENCES users(id)%'
        )
      ) as notification_delivery_log_constraints,
      to_regclass(
        'public.idx_notification_delivery_email_due_work'
      ) is not null as notification_delivery_due_work_index,
      EXISTS (
        SELECT 1
        FROM pg_index index_row
        INNER JOIN pg_class index_class ON index_class.oid = index_row.indexrelid
        WHERE index_class.relname = 'idx_notification_delivery_email_due_work'
          AND index_row.indrelid = to_regclass('public.notification_delivery_log')
          AND index_row.indisvalid
          AND index_row.indisready
          AND index_row.indnkeyatts = 6
          AND pg_get_indexdef(index_row.indexrelid, 1, true) = 'delivery_method'
          AND pg_get_indexdef(index_row.indexrelid, 2, true) = 'status'
          AND pg_get_indexdef(index_row.indexrelid, 3, true)
            = 'COALESCE(next_retry_at, created_at)'
          AND pg_get_indexdef(index_row.indexrelid, 4, true) = 'updated_at'
          AND pg_get_indexdef(index_row.indexrelid, 5, true) = 'created_at'
          AND pg_get_indexdef(index_row.indexrelid, 6, true) = 'id'
          AND pg_get_expr(index_row.indpred, index_row.indrelid) LIKE '%pending%'
          AND pg_get_expr(index_row.indpred, index_row.indrelid) LIKE '%retry_scheduled%'
          AND pg_get_expr(index_row.indpred, index_row.indrelid) LIKE '%processing%'
      ) as notification_delivery_due_work_index_definition
  `);
  const row = schemaResult.rows?.[0] || {};
  const check = {
    publicationRules: Boolean(row.publication_rules),
    seoPruneLog: Boolean(row.seo_prune_log),
    publicActivity: Boolean(row.public_activity),
    authActionTokens: Boolean(row.auth_action_tokens),
    authActionTokenColumnShape: Boolean(row.auth_action_token_column_shape),
    authActionTokenConstraints: Boolean(row.auth_action_token_constraints),
    authActionTokenUniqueIndexes: Boolean(row.auth_action_token_unique_indexes),
    notificationDeliveryLog: Boolean(row.notification_delivery_log),
    notificationDeliveryLogColumns: Boolean(row.notification_delivery_log_columns),
    notificationDeliveryLogColumnShape: Boolean(row.notification_delivery_log_column_shape),
    notificationDeliveryLogConstraints: Boolean(row.notification_delivery_log_constraints),
    notificationDeliveryDueWorkIndex: Boolean(row.notification_delivery_due_work_index),
    notificationDeliveryDueWorkIndexDefinition: Boolean(
      row.notification_delivery_due_work_index_definition
    ),
    assignmentProviderKey: Boolean(row.assignment_provider_key),
    assignmentProviderKeyUnique: Boolean(row.assignment_provider_key_unique),
    assignmentProviderKeyUniqueDefinition: Boolean(row.assignment_provider_key_unique_definition),
    directConnectResponseBindingColumns: Boolean(row.direct_connect_response_binding_columns),
    directConnectResponseBindingIndex: Boolean(row.direct_connect_response_binding_index),
    directConnectContactGateBindingColumns: Boolean(
      row.direct_connect_contact_gate_binding_columns
    ),
    directConnectLedgerFoundationTables: Boolean(row.direct_connect_ledger_foundation_tables),
    directConnectNotificationsIdempotencyIndex: Boolean(
      row.direct_connect_notifications_idempotency_index
    ),
    directConnectBindingRepairQuarantine: Boolean(row.direct_connect_binding_repair_quarantine),
    directConnectBindingRepairReady: Boolean(row.direct_connect_binding_repair_ready),
    directConnectExactBindingViolations: Boolean(row.direct_connect_exact_binding_violations),
    directConnectExactBindingReady: false,
    publicDiscoveryEnabled: Boolean(row.public_discovery_enabled),
    migrationLedger: Boolean(row.migration_ledger),
    migrationRecorded: false,
    authActionMigrationRecorded: false,
    assignmentProviderKeyMigrationRecorded: false,
    notificationDeliveryOutboxMigrationRecorded: false,
    notificationDeliveryClaimOwnershipMigrationRecorded: false,
    directConnectResponseBindingMigrationRecorded: false,
    directConnectContactGateBindingMigrationRecorded: false,
    directConnectLedgerFoundationMigrationRecorded: false,
    defaultPublicationRule: false,
  };

  if (check.directConnectExactBindingViolations) {
    const exactBindingResult = await client.query(`
      SELECT NOT EXISTS (
        SELECT 1
        FROM direct_connect_exact_binding_violations
      ) AS ready
    `);
    check.directConnectExactBindingReady = Boolean(exactBindingResult.rows?.[0]?.ready);
  }

  if (check.migrationLedger) {
    const migrationResult = await client.query(
      `
        select
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = $1
          ) as required_migration_present,
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = $2
          ) as auth_action_migration_present,
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = $3
          ) as assignment_provider_key_migration_present,
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = $4
          ) as notification_delivery_outbox_migration_present,
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = $5
          ) as notification_delivery_claim_ownership_migration_present,
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = $6
          ) as direct_connect_response_binding_migration_present,
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = $7
          ) as direct_connect_contact_gate_binding_migration_present,
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = $8
          ) as direct_connect_ledger_foundation_migration_present
      `,
      [
        REQUIRED_MIGRATION_HASH,
        AUTH_ACTION_TOKEN_MIGRATION_HASH,
        ASSIGNMENT_PROVIDER_KEY_MIGRATION_HASH,
        NOTIFICATION_DELIVERY_OUTBOX_MIGRATION_HASH,
        NOTIFICATION_DELIVERY_CLAIM_OWNERSHIP_MIGRATION_HASH,
        DIRECT_CONNECT_RESPONSE_BINDING_MIGRATION_HASH,
        DIRECT_CONNECT_CONTACT_GATE_BINDING_MIGRATION_HASH,
        DIRECT_CONNECT_LEDGER_FOUNDATION_MIGRATION_HASH,
      ]
    );
    check.migrationRecorded = Boolean(migrationResult.rows?.[0]?.required_migration_present);
    check.authActionMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.auth_action_migration_present
    );
    check.assignmentProviderKeyMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.assignment_provider_key_migration_present
    );
    check.notificationDeliveryOutboxMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.notification_delivery_outbox_migration_present
    );
    check.notificationDeliveryClaimOwnershipMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.notification_delivery_claim_ownership_migration_present
    );
    check.directConnectResponseBindingMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.direct_connect_response_binding_migration_present
    );
    check.directConnectContactGateBindingMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.direct_connect_contact_gate_binding_migration_present
    );
    check.directConnectLedgerFoundationMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.direct_connect_ledger_foundation_migration_present
    );
  }

  if (check.publicationRules) {
    const rulesResult = await client.query(
      "select exists (select 1 from ts_publication_rules where id = 'default') as present"
    );
    check.defaultPublicationRule = Boolean(rulesResult.rows?.[0]?.present);
  }

  const missing = evaluateRequiredProductionSchema(check);
  if (missing.length > 0) {
    throw new Error(
      [
        `Required production schema is missing: ${missing.join(", ")}`,
        "Recover by applying and recording the committed canonical migrations",
        "migrations/0072_seo_publication_rules_and_freshness.sql and",
        "migrations/0109_auth_action_tokens.sql and",
        "migrations/0110_work_request_assignment_provider_key.sql and",
        "migrations/0111_notification_delivery_outbox_guard.sql and",
        "migrations/0112_notification_delivery_claim_ownership.sql and",
        "migrations/0113_direct_connect_response_assignment_binding.sql and",
        "migrations/0114_direct_connect_contact_gate_binding.sql and",
        "migrations/0115_direct_connect_ledger_foundation.sql before deployment.",
      ].join(" ")
    );
  }

  return check;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL must be set");

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await verifyRequiredProductionSchema(client);
    await client.query("ROLLBACK");
    console.log("[db:verify:required] Required production schema is present", result);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original verification error is more actionable.
    }
    throw error;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(
      "[db:verify:required] Failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  });
}
