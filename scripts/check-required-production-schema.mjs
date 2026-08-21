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
export const PROFILE_ACCOUNT_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0115_profile_accounts.sql"
);
export const ADMIN_LIVE_STREAM_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0116_admin_live_stream_snapshots.sql"
);
export const MANAGED_PARTNER_INTAKES_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0117_managed_partner_intakes.sql"
);

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function buildLineEndingCompatibleMigrationHashes(sql) {
  const lf = String(sql).replace(/\r\n?/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  return [...new Set([sha256(lf), sha256(crlf)])];
}

function normalizeSqlBody(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

const profileAccountMigrationSql = fs.readFileSync(PROFILE_ACCOUNT_MIGRATION_PATH, "utf8");
const profileAccountIdentityFunctionMatch = profileAccountMigrationSql.match(
  /CREATE OR REPLACE FUNCTION enforce_profile_account_identity\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/i
);
if (!profileAccountIdentityFunctionMatch?.[1]) {
  throw new Error("0115 is missing the canonical profile-account identity function body");
}
export const PROFILE_ACCOUNT_IDENTITY_FUNCTION_BODY = normalizeSqlBody(
  profileAccountIdentityFunctionMatch[1]
);

export const REQUIRED_MIGRATION_HASHES = buildLineEndingCompatibleMigrationHashes(
  fs.readFileSync(REQUIRED_MIGRATION_PATH, "utf8")
);
export const REQUIRED_MIGRATION_HASH = REQUIRED_MIGRATION_HASHES[0];
export const PROFILE_ACCOUNT_MIGRATION_HASHES = buildLineEndingCompatibleMigrationHashes(
  profileAccountMigrationSql
);
export const PROFILE_ACCOUNT_MIGRATION_HASH = PROFILE_ACCOUNT_MIGRATION_HASHES[0];
export const ADMIN_LIVE_STREAM_MIGRATION_HASHES = buildLineEndingCompatibleMigrationHashes(
  fs.readFileSync(ADMIN_LIVE_STREAM_MIGRATION_PATH, "utf8")
);
export const ADMIN_LIVE_STREAM_MIGRATION_HASH = ADMIN_LIVE_STREAM_MIGRATION_HASHES[0];
export const MANAGED_PARTNER_INTAKES_MIGRATION_HASHES = buildLineEndingCompatibleMigrationHashes(
  fs.readFileSync(MANAGED_PARTNER_INTAKES_MIGRATION_PATH, "utf8")
);
export const MANAGED_PARTNER_INTAKES_MIGRATION_HASH =
  MANAGED_PARTNER_INTAKES_MIGRATION_HASHES[0];

export function evaluateRequiredProductionSchema(check) {
  const missing = [];
  if (!check.migrationLedger) {
    missing.push("drizzle.__drizzle_migrations");
  } else if (!check.migrationRecorded) {
    missing.push("drizzle.__drizzle_migrations[0072 canonical hash]");
  }
  if (check.migrationLedger && !check.profileAccountMigrationRecorded) {
    missing.push("drizzle.__drizzle_migrations[0115 canonical hash]");
  }
  if (check.migrationLedger && !check.adminLiveStreamMigrationRecorded) {
    missing.push("drizzle.__drizzle_migrations[0116 canonical hash]");
  }
  if (check.migrationLedger && !check.managedPartnerIntakesMigrationRecorded) {
    missing.push("drizzle.__drizzle_migrations[0117 canonical hash]");
  }
  if (!check.publicationRules) missing.push("ts_publication_rules");
  if (!check.seoPruneLog) missing.push("ts_seo_prune_log");
  if (!check.publicActivity) missing.push("ts_public_activity");
  if (!check.publicDiscoveryEnabled) missing.push("businesses.public_discovery_enabled");
  if (!check.profileAccounts) missing.push("profile_accounts");
  if (check.profileAccounts && !check.profileAccountsContract) {
    missing.push("profile_accounts[canonical columns/constraints/indexes]");
  }
  if (!check.profileAccountEntitlements) missing.push("profile_account_entitlements");
  if (check.profileAccountEntitlements && !check.profileAccountEntitlementsContract) {
    missing.push("profile_account_entitlements[canonical columns/constraints/indexes]");
  }
  if (!check.profileAccountIdentityTrigger) {
    missing.push("profile_accounts_identity_trigger");
  }
  if (!check.adminLiveStreamSnapshots) missing.push("admin_live_stream_snapshots");
  if (check.adminLiveStreamSnapshots && !check.adminLiveStreamSnapshotsContract) {
    missing.push("admin_live_stream_snapshots[canonical columns/constraints/indexes]");
  }
  if (!check.adminLiveStreamSnapshotHistory) {
    missing.push("admin_live_stream_snapshot_history");
  }
  if (
    check.adminLiveStreamSnapshotHistory &&
    !check.adminLiveStreamSnapshotHistoryContract
  ) {
    missing.push("admin_live_stream_snapshot_history[canonical columns/constraints/indexes]");
  }
  if (!check.managedPartnerIntakes) missing.push("managed_partner_intakes");
  if (check.managedPartnerIntakes && !check.managedPartnerIntakesContract) {
    missing.push("managed_partner_intakes[canonical columns/constraints/indexes]");
  }
  if (check.publicationRules && !check.defaultPublicationRule) {
    missing.push("ts_publication_rules[id=default]");
  }
  return missing;
}

export async function verifyRequiredProductionSchema(client) {
  const schemaResult = await client.query(`
    with expected_columns (
      table_name,
      column_name,
      allowed_udt_names,
      is_nullable,
      max_length,
      default_expression
    ) as (
      values
        ('profile_accounts', 'id', array['uuid']::text[], 'NO', null::integer, 'gen_random_uuid()'::text),
        ('profile_accounts', 'owner_user_id', array['text', 'varchar']::text[], 'NO', null, null),
        ('profile_accounts', 'business_profile_id', array['text', 'varchar']::text[], 'YES', null, null),
        ('profile_accounts', 'target_profile_id', array['text', 'varchar']::text[], 'NO', null, null),
        ('profile_accounts', 'target_business_id', array['text', 'varchar']::text[], 'YES', null, null),
        ('profile_accounts', 'identity_kind', array['text']::text[], 'NO', null, null),
        ('profile_accounts', 'priority_key', array['text']::text[], 'NO', null, '''profile_account''::text'),
        ('profile_accounts', 'status', array['text']::text[], 'NO', null, '''active''::text'),
        ('profile_accounts', 'verification_status', array['text']::text[], 'NO', null, '''not_required''::text'),
        ('profile_accounts', 'source_path', array['text']::text[], 'YES', null, null),
        ('profile_accounts', 'resume_path', array['text']::text[], 'YES', null, null),
        ('profile_accounts', 'created_at', array['timestamptz']::text[], 'NO', null, 'now()'),
        ('profile_accounts', 'last_seen_at', array['timestamptz']::text[], 'NO', null, 'now()'),
        ('profile_accounts', 'updated_at', array['timestamptz']::text[], 'NO', null, 'now()'),

        ('profile_account_entitlements', 'id', array['uuid']::text[], 'NO', null, 'gen_random_uuid()'),
        ('profile_account_entitlements', 'profile_account_id', array['uuid']::text[], 'NO', null, null),
        ('profile_account_entitlements', 'product_key', array['text']::text[], 'NO', null, null),
        ('profile_account_entitlements', 'status', array['text']::text[], 'NO', null, '''pending_verification''::text'),
        ('profile_account_entitlements', 'created_at', array['timestamptz']::text[], 'NO', null, 'now()'),
        ('profile_account_entitlements', 'updated_at', array['timestamptz']::text[], 'NO', null, 'now()'),

        ('admin_live_stream_snapshots', 'id', array['int8']::text[], 'NO', null, 'nextval(''admin_live_stream_snapshots_id_seq''::regclass)'),
        ('admin_live_stream_snapshots', 'source_filter', array['text']::text[], 'YES', null, null),
        ('admin_live_stream_snapshots', 'state_code', array['varchar']::text[], 'YES', 2, null),
        ('admin_live_stream_snapshots', 'county_filter', array['text']::text[], 'YES', null, null),
        ('admin_live_stream_snapshots', 'limit_value', array['int4']::text[], 'NO', null, '20'),
        ('admin_live_stream_snapshots', 'summary_json', array['jsonb']::text[], 'NO', null, '''{}''::jsonb'),
        ('admin_live_stream_snapshots', 'stream_json', array['jsonb']::text[], 'NO', null, '''[]''::jsonb'),
        ('admin_live_stream_snapshots', 'computed_at', array['timestamptz']::text[], 'NO', null, 'now()'),
        ('admin_live_stream_snapshots', 'created_at', array['timestamptz']::text[], 'NO', null, 'now()'),

        ('admin_live_stream_snapshot_history', 'id', array['int8']::text[], 'NO', null, 'nextval(''admin_live_stream_snapshot_history_id_seq''::regclass)'),
        ('admin_live_stream_snapshot_history', 'source_filter', array['text']::text[], 'YES', null, null),
        ('admin_live_stream_snapshot_history', 'state_code', array['varchar']::text[], 'YES', 2, null),
        ('admin_live_stream_snapshot_history', 'county_filter', array['text']::text[], 'YES', null, null),
        ('admin_live_stream_snapshot_history', 'limit_value', array['int4']::text[], 'NO', null, '20'),
        ('admin_live_stream_snapshot_history', 'summary_json', array['jsonb']::text[], 'NO', null, '''{}''::jsonb'),
        ('admin_live_stream_snapshot_history', 'stream_json', array['jsonb']::text[], 'NO', null, '''[]''::jsonb'),
        ('admin_live_stream_snapshot_history', 'computed_at', array['timestamptz']::text[], 'NO', null, 'now()'),
        ('admin_live_stream_snapshot_history', 'created_at', array['timestamptz']::text[], 'NO', null, 'now()'),

        ('managed_partner_intakes', 'id', array['uuid']::text[], 'NO', null, 'gen_random_uuid()'),
        ('managed_partner_intakes', 'display_name', array['text']::text[], 'NO', null, null),
        ('managed_partner_intakes', 'slug', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'source_urls', array['jsonb']::text[], 'NO', null, '''[]''::jsonb'),
        ('managed_partner_intakes', 'archetype', array['text']::text[], 'NO', null, '''contractor''::text'),
        ('managed_partner_intakes', 'control_mode', array['text']::text[], 'NO', null, '''tradescout_admin_controlled''::text'),
        ('managed_partner_intakes', 'contact_mode', array['text']::text[], 'NO', null, '''tradescout_managed''::text'),
        ('managed_partner_intakes', 'exposure_mode', array['text']::text[], 'NO', null, '''public''::text'),
        ('managed_partner_intakes', 'request_mode', array['text']::text[], 'NO', null, '''profile_request_flow''::text'),
        ('managed_partner_intakes', 'request_recipient_slug', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'expected_primary_cta', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'expected_phone', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'expected_email', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'expected_notification_email', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'relationship_label', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'notes', array['text']::text[], 'NO', null, '''''::text'),
        ('managed_partner_intakes', 'stage', array['text']::text[], 'NO', null, '''incoming''::text'),
        ('managed_partner_intakes', 'priority', array['text']::text[], 'NO', null, '''normal''::text'),
        ('managed_partner_intakes', 'latest_action', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'blocker_note', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'created_by_user_id', array['text']::text[], 'NO', null, null),
        ('managed_partner_intakes', 'assigned_to_user_id', array['text']::text[], 'YES', null, null),
        ('managed_partner_intakes', 'created_at', array['timestamptz']::text[], 'NO', null, 'now()'),
        ('managed_partner_intakes', 'updated_at', array['timestamptz']::text[], 'NO', null, 'now()'),
        ('managed_partner_intakes', 'archived_at', array['timestamptz']::text[], 'YES', null, null)
    ),
    column_contracts as (
      select
        expected.table_name,
        bool_and(
          coalesce(
            actual.column_name is not null
              and actual.udt_name = any(expected.allowed_udt_names)
              and actual.is_nullable = expected.is_nullable
              and actual.character_maximum_length is not distinct from expected.max_length
              and (
                (expected.default_expression is null and actual.column_default is null)
                or lower(regexp_replace(actual.column_default, '[[:space:]]+', '', 'g')) = expected.default_expression
              ),
            false
          )
        ) as valid
      from expected_columns expected
      left join information_schema.columns actual
        on actual.table_schema = 'public'
       and actual.table_name = expected.table_name
       and actual.column_name = expected.column_name
      group by expected.table_name
    ),
    expected_constraints (
      table_name,
      constraint_name,
      constraint_type,
      local_columns,
      foreign_table,
      foreign_columns,
      delete_action,
      schema_marker
    ) as (
      values
        ('profile_accounts', 'profile_accounts_pkey', 'p', array['id']::text[], null::text, null::text[], null::text, null::text),
        ('profile_accounts', 'profile_accounts_owner_user_fk', 'f', array['owner_user_id']::text[], 'users', array['id']::text[], 'c', 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_business_profile_fk', 'f', array['business_profile_id']::text[], 'user_profiles', array['id']::text[], 'c', 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_target_profile_fk', 'f', array['target_profile_id']::text[], 'profiles', array['id']::text[], 'c', 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_target_business_fk', 'f', array['target_business_id']::text[], 'businesses', array['id']::text[], 'n', 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_owner_target_unique', 'u', array['owner_user_id', 'target_profile_id']::text[], null, null, null, 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_identity_kind_check', 'c', null, null, null, null, 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_priority_key_check', 'c', null, null, null, null, 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_status_check', 'c', null, null, null, null, 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_verification_status_check', 'c', null, null, null, null, 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_identity_consistency_check', 'c', null, null, null, null, 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'profile_accounts_source_path_check', 'c', null, null, null, null, 'tradescout-schema:0118:v1'),
        ('profile_accounts', 'profile_accounts_resume_path_check', 'c', null, null, null, null, 'tradescout-schema:0118:v1'),

        ('profile_account_entitlements', 'profile_account_entitlements_pkey', 'p', array['id']::text[], null, null, null, null),
        ('profile_account_entitlements', 'profile_account_entitlements_account_fk', 'f', array['profile_account_id']::text[], 'profile_accounts', array['id']::text[], 'c', 'tradescout-schema:0115:v1'),
        ('profile_account_entitlements', 'profile_account_entitlements_account_product_unique', 'u', array['profile_account_id', 'product_key']::text[], null, null, null, 'tradescout-schema:0115:v1'),
        ('profile_account_entitlements', 'profile_account_entitlements_product_key_check', 'c', null, null, null, null, 'tradescout-schema:0115:v1'),
        ('profile_account_entitlements', 'profile_account_entitlements_status_check', 'c', null, null, null, null, 'tradescout-schema:0115:v1'),

        ('admin_live_stream_snapshots', 'admin_live_stream_snapshots_pkey', 'p', array['id']::text[], null, null, null, null),
        ('admin_live_stream_snapshot_history', 'admin_live_stream_snapshot_history_pkey', 'p', array['id']::text[], null, null, null, null),

        ('managed_partner_intakes', 'managed_partner_intakes_pkey', 'p', array['id']::text[], null, null, null, null),
        ('managed_partner_intakes', 'managed_partner_intakes_stage_check', 'c', null, null, null, null, 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'managed_partner_intakes_priority_check', 'c', null, null, null, null, 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'managed_partner_intakes_archetype_check', 'c', null, null, null, null, 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'managed_partner_intakes_control_mode_check', 'c', null, null, null, null, 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'managed_partner_intakes_contact_mode_check', 'c', null, null, null, null, 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'managed_partner_intakes_exposure_mode_check', 'c', null, null, null, null, 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'managed_partner_intakes_request_mode_check', 'c', null, null, null, null, 'tradescout-schema:0117:v1')
    ),
    constraint_contracts as (
      select
        expected.table_name,
        bool_and(
          exists (
            select 1
            from pg_constraint constraint_record
            join pg_class relation on relation.oid = constraint_record.conrelid
            join pg_namespace namespace on namespace.oid = relation.relnamespace
            left join pg_class referenced_relation on referenced_relation.oid = constraint_record.confrelid
            left join pg_namespace referenced_namespace on referenced_namespace.oid = referenced_relation.relnamespace
            where namespace.nspname = 'public'
              and relation.relname::text = expected.table_name
              and relation.relkind in ('r', 'p')
              and constraint_record.conname::text = expected.constraint_name
              and constraint_record.contype::text = expected.constraint_type
              and constraint_record.convalidated
              and not constraint_record.condeferrable
              and not constraint_record.condeferred
              and (
                expected.local_columns is null
                or (
                  select array_agg(attribute.attname::text order by key_column.ordinality)
                  from unnest(constraint_record.conkey) with ordinality key_column(attnum, ordinality)
                  join pg_attribute attribute
                    on attribute.attrelid = relation.oid
                   and attribute.attnum = key_column.attnum
                ) = expected.local_columns
              )
              and (
                expected.foreign_table is null
                or (
                  referenced_namespace.nspname = 'public'
                  and referenced_relation.relname::text = expected.foreign_table
                )
              )
              and (
                expected.foreign_columns is null
                or (
                  select array_agg(attribute.attname::text order by key_column.ordinality)
                  from unnest(constraint_record.confkey) with ordinality key_column(attnum, ordinality)
                  join pg_attribute attribute
                    on attribute.attrelid = referenced_relation.oid
                   and attribute.attnum = key_column.attnum
                ) = expected.foreign_columns
              )
              and (
                expected.delete_action is null
                or constraint_record.confdeltype::text = expected.delete_action
              )
              and (
                expected.schema_marker is null
                or obj_description(constraint_record.oid, 'pg_constraint') = expected.schema_marker
              )
          )
        ) as valid
      from expected_constraints expected
      group by expected.table_name
    ),
    expected_indexes (
      table_name,
      index_name,
      is_unique,
      key_patterns,
      descending_flags,
      predicate_pattern,
      schema_marker
    ) as (
      values
        ('profile_accounts', 'idx_profile_accounts_target', false, array['target_profile_id%', 'status%', 'updated_at%']::text[], array[false, false, true]::boolean[], null::text, 'tradescout-schema:0115:v1'::text),
        ('profile_accounts', 'idx_profile_accounts_owner', false, array['owner_user_id%', 'status%', 'updated_at%']::text[], array[false, false, true]::boolean[], null, 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'idx_profile_accounts_business', false, array['business_profile_id%', 'status%', 'updated_at%']::text[], array[false, false, true]::boolean[], '%business_profile_id is not null%', 'tradescout-schema:0115:v1'),
        ('profile_account_entitlements', 'idx_profile_account_entitlements_product_status', false, array['product_key%', 'status%', 'updated_at%']::text[], array[false, false, true]::boolean[], null, 'tradescout-schema:0115:v1'),
        ('admin_live_stream_snapshots', 'idx_admin_live_stream_snapshots_unique', true, array['coalesce(source_filter,%', 'coalesce(state_code,%', 'coalesce(county_filter,%', 'limit_value%']::text[], array[false, false, false, false]::boolean[], null, 'tradescout-schema:0116:v1'),
        ('admin_live_stream_snapshot_history', 'idx_admin_live_stream_snapshot_history_lookup', false, array['coalesce(source_filter,%', 'coalesce(state_code,%', 'coalesce(county_filter,%', 'computed_at%']::text[], array[false, false, false, true]::boolean[], null, 'tradescout-schema:0116:v1'),
        ('managed_partner_intakes', 'idx_managed_partner_intakes_slug_unique', true, array['lower(slug)%']::text[], array[false]::boolean[], '%slug is not null%and%length%> 0%and%archived_at is null%', 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'idx_managed_partner_intakes_active_queue', false, array['stage%', 'priority%', 'updated_at%']::text[], array[false, false, true]::boolean[], '%archived_at is null%', 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'idx_managed_partner_intakes_created_by', false, array['created_by_user_id%', 'created_at%']::text[], array[false, true]::boolean[], null, 'tradescout-schema:0117:v1')
    ),
    index_contracts as (
      select
        expected.table_name,
        bool_and(
          exists (
            select 1
            from pg_index index_record
            join pg_class index_relation on index_relation.oid = index_record.indexrelid
            join pg_class table_relation on table_relation.oid = index_record.indrelid
            join pg_namespace namespace on namespace.oid = table_relation.relnamespace
            join pg_am access_method on access_method.oid = index_relation.relam
            where namespace.nspname = 'public'
              and table_relation.relname::text = expected.table_name
              and table_relation.relkind in ('r', 'p')
              and index_relation.relnamespace = namespace.oid
              and index_relation.relname::text = expected.index_name
              and index_relation.relkind = 'i'
              and access_method.amname = 'btree'
              and index_record.indisunique = expected.is_unique
              and index_record.indisvalid
              and index_record.indisready
              and index_record.indislive
              and obj_description(index_record.indexrelid, 'pg_class') = expected.schema_marker
              and index_record.indnkeyatts = cardinality(expected.key_patterns)
              and not exists (
                select 1
                from unnest(expected.key_patterns) with ordinality key_pattern(pattern, ordinality)
                where lower(regexp_replace(
                  pg_get_indexdef(index_record.indexrelid, key_pattern.ordinality::integer, true),
                  '[[:space:]]+',
                  ' ',
                  'g'
                )) not like key_pattern.pattern
              )
              and not exists (
                select 1
                from unnest(expected.descending_flags) with ordinality direction(is_descending, ordinality)
                left join unnest(index_record.indoption) with ordinality actual_direction(option_bits, ordinality)
                  on actual_direction.ordinality = direction.ordinality
                where actual_direction.option_bits is null
                   or (((actual_direction.option_bits & 1) = 1)
                     is distinct from direction.is_descending)
              )
              and (
                (expected.predicate_pattern is null and index_record.indpred is null)
                or (
                  expected.predicate_pattern is not null
                  and index_record.indpred is not null
                  and lower(regexp_replace(
                    pg_get_expr(index_record.indpred, index_record.indrelid, true),
                    '[[:space:]]+',
                    ' ',
                    'g'
                  )) like expected.predicate_pattern
                )
              )
          )
        ) as valid
      from expected_indexes expected
      group by expected.table_name
    )
    select
      to_regclass('public.ts_publication_rules') is not null as publication_rules,
      to_regclass('public.ts_seo_prune_log') is not null as seo_prune_log,
      to_regclass('public.ts_public_activity') is not null as public_activity,
      to_regclass('public.profile_accounts') is not null as profile_accounts,
      to_regclass('public.profile_account_entitlements') is not null as profile_account_entitlements,
      to_regclass('public.admin_live_stream_snapshots') is not null as admin_live_stream_snapshots,
      to_regclass('public.admin_live_stream_snapshot_history') is not null as admin_live_stream_snapshot_history,
      to_regclass('public.managed_partner_intakes') is not null as managed_partner_intakes,
      to_regclass('drizzle.__drizzle_migrations') is not null as migration_ledger,
      coalesce((select valid from column_contracts where table_name = 'profile_accounts'), false)
        and coalesce((select valid from constraint_contracts where table_name = 'profile_accounts'), false)
        and coalesce((select valid from index_contracts where table_name = 'profile_accounts'), false)
        as profile_accounts_contract,
      coalesce((select valid from column_contracts where table_name = 'profile_account_entitlements'), false)
        and coalesce((select valid from constraint_contracts where table_name = 'profile_account_entitlements'), false)
        and coalesce((select valid from index_contracts where table_name = 'profile_account_entitlements'), false)
        as profile_account_entitlements_contract,
      coalesce((select valid from column_contracts where table_name = 'admin_live_stream_snapshots'), false)
        and coalesce((select valid from constraint_contracts where table_name = 'admin_live_stream_snapshots'), false)
        and coalesce((select valid from index_contracts where table_name = 'admin_live_stream_snapshots'), false)
        as admin_live_stream_snapshots_contract,
      coalesce((select valid from column_contracts where table_name = 'admin_live_stream_snapshot_history'), false)
        and coalesce((select valid from constraint_contracts where table_name = 'admin_live_stream_snapshot_history'), false)
        and coalesce((select valid from index_contracts where table_name = 'admin_live_stream_snapshot_history'), false)
        as admin_live_stream_snapshot_history_contract,
      coalesce((select valid from column_contracts where table_name = 'managed_partner_intakes'), false)
        and coalesce((select valid from constraint_contracts where table_name = 'managed_partner_intakes'), false)
        and coalesce((select valid from index_contracts where table_name = 'managed_partner_intakes'), false)
        as managed_partner_intakes_contract,
      exists (
        select 1
        from pg_trigger trigger_record
        join pg_class relation on relation.oid = trigger_record.tgrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        join pg_proc procedure_record on procedure_record.oid = trigger_record.tgfoid
        join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace
        where namespace.nspname = 'public'
          and relation.relname = 'profile_accounts'
          and trigger_record.tgname = 'profile_accounts_identity_trigger'
          and not trigger_record.tgisinternal
          and trigger_record.tgenabled = 'O'
          and trigger_record.tgtype = 23
          and trigger_record.tgnargs = 0
          and trigger_record.tgqual is null
          and trigger_record.tgconstraint = 0
          and obj_description(trigger_record.oid, 'pg_trigger') = 'tradescout-schema:0115:v1'
          and procedure_namespace.nspname = 'public'
          and procedure_record.proname = 'enforce_profile_account_identity'
          and procedure_record.pronargs = 0
          and procedure_record.prorettype = 'trigger'::regtype
          and (
            select array_agg(attribute.attname::text order by attribute.attname::text)
            from unnest(trigger_record.tgattr) with ordinality trigger_column(attnum, ordinality)
            join pg_attribute attribute
              on attribute.attrelid = relation.oid
             and attribute.attnum = trigger_column.attnum
          ) = array['business_profile_id', 'identity_kind', 'owner_user_id', 'verification_status']::text[]
          and trim(regexp_replace(
            procedure_record.prosrc,
            '[[:space:]]+',
            ' ',
            'g'
          )) = $1
      ) as profile_account_identity_trigger,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'businesses'
          and column_name = 'public_discovery_enabled'
      ) as public_discovery_enabled
  `, [PROFILE_ACCOUNT_IDENTITY_FUNCTION_BODY]);
  const row = schemaResult.rows?.[0] || {};
  const check = {
    publicationRules: Boolean(row.publication_rules),
    seoPruneLog: Boolean(row.seo_prune_log),
    publicActivity: Boolean(row.public_activity),
    publicDiscoveryEnabled: Boolean(row.public_discovery_enabled),
    profileAccounts: Boolean(row.profile_accounts),
    profileAccountsContract: Boolean(row.profile_accounts_contract),
    profileAccountEntitlements: Boolean(row.profile_account_entitlements),
    profileAccountEntitlementsContract: Boolean(row.profile_account_entitlements_contract),
    profileAccountIdentityTrigger: Boolean(row.profile_account_identity_trigger),
    adminLiveStreamSnapshots: Boolean(row.admin_live_stream_snapshots),
    adminLiveStreamSnapshotsContract: Boolean(row.admin_live_stream_snapshots_contract),
    adminLiveStreamSnapshotHistory: Boolean(row.admin_live_stream_snapshot_history),
    adminLiveStreamSnapshotHistoryContract: Boolean(
      row.admin_live_stream_snapshot_history_contract
    ),
    managedPartnerIntakes: Boolean(row.managed_partner_intakes),
    managedPartnerIntakesContract: Boolean(row.managed_partner_intakes_contract),
    migrationLedger: Boolean(row.migration_ledger),
    migrationRecorded: false,
    profileAccountMigrationRecorded: false,
    adminLiveStreamMigrationRecorded: false,
    managedPartnerIntakesMigrationRecorded: false,
    defaultPublicationRule: false,
  };

  if (check.migrationLedger) {
    const migrationResult = await client.query(
      `
        select
          exists (
            select 1
            from drizzle.__drizzle_migrations
            where hash = any($1::text[])
          ) as required_present,
          exists (
            select 1
            from drizzle.__drizzle_migrations
            where hash = any($2::text[])
          ) as profile_accounts_present,
          exists (
            select 1
            from drizzle.__drizzle_migrations
            where hash = any($3::text[])
          ) as admin_live_stream_present,
          exists (
            select 1
            from drizzle.__drizzle_migrations
            where hash = any($4::text[])
          ) as managed_partner_intakes_present
      `,
      [
        REQUIRED_MIGRATION_HASHES,
        PROFILE_ACCOUNT_MIGRATION_HASHES,
        ADMIN_LIVE_STREAM_MIGRATION_HASHES,
        MANAGED_PARTNER_INTAKES_MIGRATION_HASHES,
      ]
    );
    check.migrationRecorded = Boolean(migrationResult.rows?.[0]?.required_present);
    check.profileAccountMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.profile_accounts_present
    );
    check.adminLiveStreamMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.admin_live_stream_present
    );
    check.managedPartnerIntakesMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.managed_partner_intakes_present
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
        "Recover by reconciling any reported drift to the committed schema shape, then applying and recording the applicable canonical migrations",
        "migrations/0072_seo_publication_rules_and_freshness.sql and",
        "migrations/0115_profile_accounts.sql and",
        "migrations/0116_admin_live_stream_snapshots.sql and",
        "migrations/0117_managed_partner_intakes.sql before deployment.",
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
