import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { DATABASE_RECOVERY_GUIDANCE } from "./lib/verified-migration-runner.mjs";

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
export const PROFILE_BOOKING_LINEAGE_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0132_profile_booking_request_profile_lineage.sql"
);
export const PROFESSIONAL_APPLICATION_INTEGRITY_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0133_professional_application_integrity.sql"
);
export const DOCUMENT_STANDALONE_LINEAGE_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0134_document_standalone_lineage_backfill.sql"
);
export const CONTACT_RUNTIME_SCHEMA_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0135_restore_contact_runtime_schema.sql"
);

export const NOTIFICATION_OUTBOX_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0136_restore_notification_outbox_schema.sql"
);

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export const RECOMMENDATION_RUNTIME_SCHEMA_MIGRATION_HASHES =
  buildLineEndingCompatibleMigrationHashes(
    fs.readFileSync(
      path.resolve(process.cwd(), "migrations/0137_restore_recommendation_runtime_schema.sql"),
      "utf8"
    )
  );

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

const profileBookingLineageMigrationSql = fs.readFileSync(
  PROFILE_BOOKING_LINEAGE_MIGRATION_PATH,
  "utf8"
);
const profileBookingLineageFunctionMatch = profileBookingLineageMigrationSql.match(
  /CREATE OR REPLACE FUNCTION enforce_profile_booking_request_lineage_immutability\(\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/i
);
if (!profileBookingLineageFunctionMatch?.[1]) {
  throw new Error("0128 is missing the canonical booking-lineage immutability function body");
}
export const PROFILE_BOOKING_LINEAGE_FUNCTION_BODY = normalizeSqlBody(
  profileBookingLineageFunctionMatch[1]
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
export const MANAGED_PARTNER_INTAKES_MIGRATION_HASH = MANAGED_PARTNER_INTAKES_MIGRATION_HASHES[0];
export const PROFILE_BOOKING_LINEAGE_MIGRATION_HASHES = buildLineEndingCompatibleMigrationHashes(
  profileBookingLineageMigrationSql
);
export const PROFILE_BOOKING_LINEAGE_MIGRATION_HASH = PROFILE_BOOKING_LINEAGE_MIGRATION_HASHES[0];
export const PROFESSIONAL_APPLICATION_INTEGRITY_MIGRATION_HASHES =
  buildLineEndingCompatibleMigrationHashes(
    fs.readFileSync(PROFESSIONAL_APPLICATION_INTEGRITY_MIGRATION_PATH, "utf8")
  );
export const PROFESSIONAL_APPLICATION_INTEGRITY_MIGRATION_HASH =
  PROFESSIONAL_APPLICATION_INTEGRITY_MIGRATION_HASHES[0];
export const DOCUMENT_STANDALONE_LINEAGE_MIGRATION_HASHES =
  buildLineEndingCompatibleMigrationHashes(
    fs.readFileSync(DOCUMENT_STANDALONE_LINEAGE_MIGRATION_PATH, "utf8")
  );
export const DOCUMENT_STANDALONE_LINEAGE_MIGRATION_HASH =
  DOCUMENT_STANDALONE_LINEAGE_MIGRATION_HASHES[0];
export const CONTACT_RUNTIME_SCHEMA_MIGRATION_HASHES = buildLineEndingCompatibleMigrationHashes(
  fs.readFileSync(CONTACT_RUNTIME_SCHEMA_MIGRATION_PATH, "utf8")
);

export const NOTIFICATION_OUTBOX_MIGRATION_HASHES = buildLineEndingCompatibleMigrationHashes(
  fs.readFileSync(NOTIFICATION_OUTBOX_MIGRATION_PATH, "utf8")
);

export function evaluateRequiredProductionSchema(check) {
  const missing = [];
  if (!check.notificationOutboxContract)
    missing.push(
      "notification_jobs/notification_templates[canonical columns, defaults, indexes and constraints]"
    );
  if (check.migrationLedger && !check.notificationOutboxMigrationRecorded)
    missing.push("drizzle.__drizzle_migrations[0136 canonical hash]");
  if (!check.recommendationRuntimeContract)
    missing.push(
      "recommendations[current columns, private defaults and legacy rating compatibility]"
    );
  if (check.migrationLedger && !check.recommendationRuntimeSchemaMigrationRecorded)
    missing.push("drizzle.__drizzle_migrations[0137 canonical hash]");
  if (!check.contractorRecommendationColumns)
    missing.push("contractors[recommendation projection columns]");
  if (!check.notificationRuntimeColumns)
    missing.push("notifications[current delivery columns and legacy content compatibility]");
  if (!check.userPrivacySettingsContract)
    missing.push("user_privacy_settings[canonical columns and account foreign key]");
  if (check.migrationLedger && !check.contactRuntimeSchemaMigrationRecorded) {
    missing.push("drizzle.__drizzle_migrations[0135 canonical hash]");
  }
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
  if (check.migrationLedger && !check.profileBookingLineageMigrationRecorded) {
    missing.push("drizzle.__drizzle_migrations[0128 canonical hash]");
  }
  if (check.migrationLedger && !check.professionalApplicationIntegrityMigrationRecorded) {
    missing.push("drizzle.__drizzle_migrations[0129 canonical hash]");
  }
  if (check.migrationLedger && !check.documentStandaloneLineageMigrationRecorded) {
    missing.push("drizzle.__drizzle_migrations[0130 canonical hash]");
  }
  if (!check.documentAccountingJobIdInvariantContract) {
    missing.push("documents[no synthetic accounting job_id invariant]");
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
  if (check.adminLiveStreamSnapshotHistory && !check.adminLiveStreamSnapshotHistoryContract) {
    missing.push("admin_live_stream_snapshot_history[canonical columns/constraints/indexes]");
  }
  if (!check.managedPartnerIntakes) missing.push("managed_partner_intakes");
  if (check.managedPartnerIntakes && !check.managedPartnerIntakesContract) {
    missing.push("managed_partner_intakes[canonical columns/constraints/indexes]");
  }
  if (!check.profileBookingRequests) missing.push("profile_booking_requests");
  if (check.profileBookingRequests && !check.profileBookingRequestsLineageContract) {
    missing.push("profile_booking_requests[explicit lineage columns/constraints/index]");
  }
  if (!check.profileBookingRequestsLineageImmutabilityTrigger) {
    missing.push("profile_booking_requests_lineage_immutability_trigger");
  }
  if (!check.profilePublicationAuthorityContract) {
    missing.push("profiles[publicly_released canonical authority column]");
  }
  if (!check.realtorProfiles) missing.push("realtor_profiles");
  if (check.realtorProfiles && !check.realtorProfilesIntegrityContract) {
    missing.push("realtor_profiles[professional application integrity contract]");
  }
  if (!check.carSalesmanProfiles) missing.push("car_salesman_profiles");
  if (check.carSalesmanProfiles && !check.carSalesmanProfilesIntegrityContract) {
    missing.push("car_salesman_profiles[professional application integrity contract]");
  }
  if (check.publicationRules && !check.defaultPublicationRule) {
    missing.push("ts_publication_rules[id=default]");
  }
  return missing;
}

export async function verifyRequiredProductionSchema(client) {
  const schemaResult = await client.query(
    `
    with expected_columns (
      table_name,
      column_name,
      allowed_udt_names,
      is_nullable,
      max_length,
      default_expression
    ) as (
      values
        ('notification_templates', 'id', array['varchar']::text[], 'NO', null, 'gen_random_uuid()'),
        ('notification_templates', 'type', array['varchar', 'notification_type']::text[], 'NO', null, null),
        ('notification_templates', 'name', array['varchar']::text[], 'NO', null, null),
        ('notification_templates', 'description', array['text']::text[], 'YES', null, null),
        ('notification_templates', 'title_template', array['varchar']::text[], 'NO', null, null),
        ('notification_templates', 'message_template', array['text']::text[], 'NO', null, null),
        ('notification_templates', 'email_subject_template', array['varchar']::text[], 'YES', null, null),
        ('notification_templates', 'email_body_template', array['text']::text[], 'YES', null, null),
        ('notification_templates', 'sms_template', array['text']::text[], 'YES', null, null),
        ('notification_templates', 'template_variables', array['jsonb']::text[], 'YES', null, null),
        ('notification_templates', 'icon_name', array['varchar']::text[], 'YES', null, null),
        ('notification_templates', 'icon_color', array['varchar']::text[], 'YES', null, '''blue''::charactervarying'),
        ('notification_templates', 'priority', array['notification_priority']::text[], 'YES', null, '''normal''::notification_priority'),
        ('notification_templates', 'default_delivery_methods', array['jsonb']::text[], 'YES', null, '''["in_app"]''::jsonb'),
        ('notification_templates', 'expires_after_hours', array['int4']::text[], 'YES', null, '168'),
        ('notification_templates', 'is_active', array['bool']::text[], 'YES', null, 'true'),
        ('notification_templates', 'is_default', array['bool']::text[], 'YES', null, 'false'),
        ('notification_templates', 'created_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('notification_templates', 'updated_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('notification_jobs', 'id', array['varchar']::text[], 'NO', null, 'gen_random_uuid()'),
        ('notification_jobs', 'job_type', array['varchar']::text[], 'NO', null, null),
        ('notification_jobs', 'scheduled_for', array['timestamp']::text[], 'NO', null, null),
        ('notification_jobs', 'target_user_ids', array['jsonb']::text[], 'YES', null, null),
        ('notification_jobs', 'target_filters', array['jsonb']::text[], 'YES', null, null),
        ('notification_jobs', 'notification_type', array['varchar', 'notification_type']::text[], 'NO', null, null),
        ('notification_jobs', 'template_id', array['varchar']::text[], 'YES', null, null),
        ('notification_jobs', 'template_data', array['jsonb']::text[], 'YES', null, null),
        ('notification_jobs', 'status', array['varchar']::text[], 'YES', null, '''pending''::charactervarying'),
        ('notification_jobs', 'started_at', array['timestamp']::text[], 'YES', null, null),
        ('notification_jobs', 'completed_at', array['timestamp']::text[], 'YES', null, null),
        ('notification_jobs', 'target_count', array['int4']::text[], 'YES', null, '0'),
        ('notification_jobs', 'success_count', array['int4']::text[], 'YES', null, '0'),
        ('notification_jobs', 'failure_count', array['int4']::text[], 'YES', null, '0'),
        ('notification_jobs', 'error_log', array['jsonb']::text[], 'YES', null, null),
        ('notification_jobs', 'max_retries', array['int4']::text[], 'YES', null, '3'),
        ('notification_jobs', 'retry_count', array['int4']::text[], 'YES', null, '0'),
        ('notification_jobs', 'next_retry_at', array['timestamp']::text[], 'YES', null, null),
        ('notification_jobs', 'created_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('notification_jobs', 'updated_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('recommendations', 'id', array['varchar']::text[], 'NO', null, 'gen_random_uuid()'),
        ('recommendations', 'contractor_id', array['varchar']::text[], 'NO', null, null),
        ('recommendations', 'user_id', array['varchar']::text[], 'NO', null, null),
        ('recommendations', 'recommendation_type', array['varchar']::text[], 'NO', null, null),
        ('recommendations', 'comment', array['text']::text[], 'NO', null, null),
        ('recommendations', 'project_type', array['varchar']::text[], 'YES', null, null),
        ('recommendations', 'project_value', array['numeric']::text[], 'YES', null, null),
        ('recommendations', 'work_quality', array['varchar']::text[], 'YES', null, null),
        ('recommendations', 'timeliness', array['varchar']::text[], 'YES', null, null),
        ('recommendations', 'communication', array['varchar']::text[], 'YES', null, null),
        ('recommendations', 'would_hire_again', array['bool']::text[], 'YES', null, null),
        ('recommendations', 'photo_url', array['varchar']::text[], 'YES', null, null),
        ('recommendations', 'customer_name', array['varchar']::text[], 'NO', null, null),
        ('recommendations', 'customer_email', array['varchar']::text[], 'NO', null, null),
        ('recommendations', 'customer_phone', array['varchar']::text[], 'YES', null, null),
        ('recommendations', 'ip_address', array['varchar']::text[], 'YES', null, null),
        ('recommendations', 'user_agent', array['text']::text[], 'YES', null, null),
        ('recommendations', 'is_verified', array['bool']::text[], 'YES', null, 'false'),
        ('recommendations', 'verification_method', array['varchar']::text[], 'YES', null, null),
        ('recommendations', 'verified_at', array['timestamp']::text[], 'YES', null, null),
        ('recommendations', 'is_public', array['bool']::text[], 'YES', null, 'false'),
        ('recommendations', 'moderation_status', array['varchar']::text[], 'YES', null, '''pending''::charactervarying'),
        ('recommendations', 'moderated_at', array['timestamp']::text[], 'YES', null, null),
        ('recommendations', 'moderated_by', array['varchar']::text[], 'YES', null, null),
        ('recommendations', 'created_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('recommendations', 'updated_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('notification_delivery_log', 'id', array['varchar']::text[], 'NO', null, 'gen_random_uuid()'),
        ('notification_delivery_log', 'notification_id', array['varchar']::text[], 'NO', null, null),
        ('notification_delivery_log', 'user_id', array['varchar']::text[], 'NO', null, null),
        ('notification_delivery_log', 'delivery_method', array['delivery_method']::text[], 'NO', null, null),
        ('notification_delivery_log', 'status', array['varchar']::text[], 'NO', null, null),
        ('notification_delivery_log', 'contact_info', array['varchar']::text[], 'YES', null, null),
        ('notification_delivery_log', 'external_id', array['varchar']::text[], 'YES', null, null),
        ('notification_delivery_log', 'external_response', array['jsonb']::text[], 'YES', null, null),
        ('notification_delivery_log', 'error_code', array['varchar']::text[], 'YES', null, null),
        ('notification_delivery_log', 'error_message', array['text']::text[], 'YES', null, null),
        ('notification_delivery_log', 'retry_count', array['int4']::text[], 'YES', null, '0'),
        ('notification_delivery_log', 'next_retry_at', array['timestamp']::text[], 'YES', null, null),
        ('notification_delivery_log', 'sent_at', array['timestamp']::text[], 'YES', null, null),
        ('notification_delivery_log', 'delivered_at', array['timestamp']::text[], 'YES', null, null),
        ('notification_delivery_log', 'failed_at', array['timestamp']::text[], 'YES', null, null),
        ('notification_delivery_log', 'created_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('notification_delivery_log', 'updated_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('notification_preferences', 'id', array['varchar']::text[], 'NO', null, 'gen_random_uuid()'),
        ('notification_preferences', 'user_id', array['varchar']::text[], 'NO', null, null),
        ('notification_preferences', 'enable_notifications', array['bool']::text[], 'YES', null, 'true'),
        ('notification_preferences', 'enable_email_notifications', array['bool']::text[], 'YES', null, 'true'),
        ('notification_preferences', 'enable_sms_notifications', array['bool']::text[], 'YES', null, 'false'),
        ('notification_preferences', 'enable_push_notifications', array['bool']::text[], 'YES', null, 'true'),
        ('notification_preferences', 'type_preferences', array['jsonb']::text[], 'YES', null, '''{}''::jsonb'),
        ('notification_preferences', 'quiet_hours_start', array['varchar']::text[], 'YES', null, '''22:00''::charactervarying'),
        ('notification_preferences', 'quiet_hours_end', array['varchar']::text[], 'YES', null, '''08:00''::charactervarying'),
        ('notification_preferences', 'timezone', array['varchar']::text[], 'YES', null, '''america/new_york''::charactervarying'),
        ('notification_preferences', 'batch_daily_digest', array['bool']::text[], 'YES', null, 'false'),
        ('notification_preferences', 'batch_weekly_digest', array['bool']::text[], 'YES', null, 'false'),
        ('notification_preferences', 'digest_time', array['varchar']::text[], 'YES', null, '''09:00''::charactervarying'),
        ('notification_preferences', 'created_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('notification_preferences', 'updated_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('contractors', 'positive_recommendations', array['int4']::text[], 'YES', null, '0'),
        ('contractors', 'negative_recommendations', array['int4']::text[], 'YES', null, '0'),
        ('contractors', 'total_recommendations', array['int4']::text[], 'YES', null, '0'),
        ('contractors', 'recommendation_score', array['numeric']::text[], 'YES', null, '0.00'),
        ('contractors', 'recommendation_percentage', array['numeric']::text[], 'YES', null, '0.00'),
        ('notifications', 'priority', array['notification_priority']::text[], 'YES', null, '''normal''::notification_priority'),
        ('notifications', 'message', array['text']::text[], 'NO', null, null),
        ('notifications', 'action_url', array['varchar']::text[], 'YES', null, null),
        ('notifications', 'action_text', array['varchar']::text[], 'YES', null, null),
        ('notifications', 'icon_name', array['varchar']::text[], 'YES', null, null),
        ('notifications', 'image_url', array['varchar']::text[], 'YES', null, null),
        ('notifications', 'group_id', array['varchar']::text[], 'YES', null, null),
        ('notifications', 'batch_id', array['varchar']::text[], 'YES', null, null),
        ('notifications', 'icon_color', array['varchar']::text[], 'YES', null, '''blue''::charactervarying'),
        ('notifications', 'metadata', array['jsonb']::text[], 'YES', null, null),
        ('notifications', 'delivery_methods', array['jsonb']::text[], 'YES', null, '''["in_app"]''::jsonb'),
        ('notifications', 'is_archived', array['bool']::text[], 'YES', null, 'false'),
        ('notifications', 'read_at', array['timestamp']::text[], 'YES', null, null),
        ('notifications', 'archived_at', array['timestamp']::text[], 'YES', null, null),
        ('notifications', 'expires_at', array['timestamp']::text[], 'YES', null, null),
        ('notifications', 'delivered_at', array['timestamp']::text[], 'YES', null, null),
        ('notifications', 'clicked_at', array['timestamp']::text[], 'YES', null, null),
        ('notifications', 'updated_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('user_privacy_settings', 'id', array['varchar']::text[], 'NO', null, 'gen_random_uuid()'),
        ('user_privacy_settings', 'user_id', array['varchar']::text[], 'NO', null, null),
        ('user_privacy_settings', 'profile_visibility', array['varchar']::text[], 'YES', null, '''public''::charactervarying'),
        ('user_privacy_settings', 'show_contact_info', array['bool']::text[], 'YES', null, 'true'),
        ('user_privacy_settings', 'allow_direct_messages', array['bool']::text[], 'YES', null, 'true'),
        ('user_privacy_settings', 'share_activity_status', array['bool']::text[], 'YES', null, 'true'),
        ('user_privacy_settings', 'allow_analytics', array['bool']::text[], 'YES', null, 'true'),
        ('user_privacy_settings', 'email_notifications', array['bool']::text[], 'YES', null, 'true'),
        ('user_privacy_settings', 'sms_notifications', array['bool']::text[], 'YES', null, 'true'),
        ('user_privacy_settings', 'data_retention_consent', array['bool']::text[], 'YES', null, 'true'),
        ('user_privacy_settings', 'allow_third_party_sharing', array['bool']::text[], 'YES', null, 'false'),
        ('user_privacy_settings', 'marketing_emails', array['bool']::text[], 'YES', null, 'false'),
        ('user_privacy_settings', 'privacy_policy_accepted', array['timestamp']::text[], 'YES', null, null),
        ('user_privacy_settings', 'terms_of_service_accepted', array['timestamp']::text[], 'YES', null, null),
        ('user_privacy_settings', 'cookie_consent', array['jsonb']::text[], 'YES', null, null),
        ('user_privacy_settings', 'created_at', array['timestamp']::text[], 'YES', null, 'now()'),
        ('user_privacy_settings', 'last_updated', array['timestamp']::text[], 'YES', null, 'now()'),
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
        ('managed_partner_intakes', 'archived_at', array['timestamptz']::text[], 'YES', null, null),

        ('profile_booking_requests', 'profile_id', array['varchar']::text[], 'YES', null, null),
        ('profile_booking_requests', 'lineage_kind', array['varchar']::text[], 'NO', null, '''legacy_owner''::charactervarying'),
        ('profiles', 'publicly_released', array['bool']::text[], 'NO', null, 'false'),

        ('realtor_profiles', 'verification_status', array['verification_status']::text[], 'NO', null, '''pending''::verification_status'),
        ('realtor_profiles', 'is_active', array['bool']::text[], 'NO', null, 'false'),
        ('realtor_profiles', 'reviewed_by', array['varchar']::text[], 'YES', null, null),
        ('realtor_profiles', 'reviewed_at', array['timestamp']::text[], 'YES', null, null),
        ('realtor_profiles', 'review_notes', array['text']::text[], 'YES', null, null),

        ('car_salesman_profiles', 'verification_status', array['verification_status']::text[], 'NO', null, '''pending''::verification_status'),
        ('car_salesman_profiles', 'is_active', array['bool']::text[], 'NO', null, 'false'),
        ('car_salesman_profiles', 'reviewed_by', array['varchar']::text[], 'YES', null, null),
        ('car_salesman_profiles', 'reviewed_at', array['timestamp']::text[], 'YES', null, null),
        ('car_salesman_profiles', 'review_notes', array['text']::text[], 'YES', null, null)
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
        ('managed_partner_intakes', 'managed_partner_intakes_control_mode_check', 'c', null, null, null, null, 'tradescout-schema:0130:v1'),
        ('managed_partner_intakes', 'managed_partner_intakes_contact_mode_check', 'c', null, null, null, null, 'tradescout-schema:0130:v1'),
        ('managed_partner_intakes', 'managed_partner_intakes_exposure_mode_check', 'c', null, null, null, null, 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'managed_partner_intakes_request_mode_check', 'c', null, null, null, null, 'tradescout-schema:0117:v1'),

        ('profile_booking_requests', 'profile_booking_requests_profile_id_fk', 'f', array['profile_id']::text[], 'profiles', array['id']::text[], 'r', 'tradescout-schema:0128:v4'),
        ('profile_booking_requests', 'profile_booking_requests_lineage_consistency_check', 'c', null, null, null, null, 'tradescout-schema:0128:v4'),
        ('realtor_profiles', 'realtor_profiles_reviewed_by_fk', 'f', array['reviewed_by']::text[], 'users', array['id']::text[], 'n', 'tradescout-schema:0129:v2'),
        ('realtor_profiles', 'realtor_profiles_review_notes_length_check', 'c', null, null, null, null, 'tradescout-schema:0129:v2'),
        ('car_salesman_profiles', 'car_salesman_profiles_reviewed_by_fk', 'f', array['reviewed_by']::text[], 'users', array['id']::text[], 'n', 'tradescout-schema:0129:v2'),
        ('car_salesman_profiles', 'car_salesman_profiles_review_notes_length_check', 'c', null, null, null, null, 'tradescout-schema:0129:v2')
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
        ('notification_jobs', 'idx_notification_jobs_scheduled', false, array['scheduled_for%']::text[], array[false]::boolean[], null, 'tradescout-schema:0136:v1'),
        ('notification_jobs', 'idx_notification_jobs_status', false, array['status%']::text[], array[false]::boolean[], null, 'tradescout-schema:0136:v1'),
        ('notification_jobs', 'idx_notification_jobs_type', false, array['job_type%']::text[], array[false]::boolean[], null, 'tradescout-schema:0136:v1'),
        ('notification_templates', 'idx_notification_templates_type', false, array['type%']::text[], array[false]::boolean[], null, 'tradescout-schema:0136:v1'),
        ('notification_templates', 'idx_notification_templates_active', false, array['is_active%']::text[], array[false]::boolean[], null, 'tradescout-schema:0136:v1'),
        ('profile_accounts', 'idx_profile_accounts_target', false, array['target_profile_id%', 'status%', 'updated_at%']::text[], array[false, false, true]::boolean[], null::text, 'tradescout-schema:0115:v1'::text),
        ('profile_accounts', 'idx_profile_accounts_owner', false, array['owner_user_id%', 'status%', 'updated_at%']::text[], array[false, false, true]::boolean[], null, 'tradescout-schema:0115:v1'),
        ('profile_accounts', 'idx_profile_accounts_business', false, array['business_profile_id%', 'status%', 'updated_at%']::text[], array[false, false, true]::boolean[], '%business_profile_id is not null%', 'tradescout-schema:0115:v1'),
        ('profile_account_entitlements', 'idx_profile_account_entitlements_product_status', false, array['product_key%', 'status%', 'updated_at%']::text[], array[false, false, true]::boolean[], null, 'tradescout-schema:0115:v1'),
        ('admin_live_stream_snapshots', 'idx_admin_live_stream_snapshots_unique', true, array['coalesce(source_filter,%', 'coalesce(state_code,%', 'coalesce(county_filter,%', 'limit_value%']::text[], array[false, false, false, false]::boolean[], null, 'tradescout-schema:0116:v1'),
        ('admin_live_stream_snapshot_history', 'idx_admin_live_stream_snapshot_history_lookup', false, array['coalesce(source_filter,%', 'coalesce(state_code,%', 'coalesce(county_filter,%', 'computed_at%']::text[], array[false, false, false, true]::boolean[], null, 'tradescout-schema:0116:v1'),
        ('managed_partner_intakes', 'idx_managed_partner_intakes_slug_unique', true, array['lower(slug)%']::text[], array[false]::boolean[], '%slug is not null%and%length%> 0%and%archived_at is null%', 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'idx_managed_partner_intakes_active_queue', false, array['stage%', 'priority%', 'updated_at%']::text[], array[false, false, true]::boolean[], '%archived_at is null%', 'tradescout-schema:0117:v1'),
        ('managed_partner_intakes', 'idx_managed_partner_intakes_created_by', false, array['created_by_user_id%', 'created_at%']::text[], array[false, true]::boolean[], null, 'tradescout-schema:0117:v1'),
        ('profile_booking_requests', 'idx_profile_booking_requests_profile', false, array['profile_id%']::text[], array[false]::boolean[], '%profile_id is not null%', 'tradescout-schema:0128:v4'),
        ('realtor_profiles', 'uq_realtor_profiles_user_id', true, array['user_id%']::text[], array[false]::boolean[], null, 'One realtor application record per user; tradescout-schema:0129:v2'),
        ('car_salesman_profiles', 'uq_car_salesman_profiles_user_id', true, array['user_id%']::text[], array[false]::boolean[], null, 'One car salesman application record per user; tradescout-schema:0129:v2')
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
      coalesce((select valid from column_contracts where table_name = 'notification_jobs'), false)
        and coalesce((select valid from column_contracts where table_name = 'notification_templates'), false)
        and coalesce((select valid from index_contracts where table_name = 'notification_jobs'), false)
        and coalesce((select valid from index_contracts where table_name = 'notification_templates'), false)
        and not exists (
          select 1 from (values ('notification_jobs'), ('notification_templates')) required(table_name)
          where not exists (
            select 1 from pg_constraint c
            where c.conrelid = to_regclass('public.' || required.table_name)
              and c.contype = 'p' and c.convalidated and not c.condeferrable
              and c.conkey = array[(select attnum from pg_attribute
                where attrelid = c.conrelid and attname = 'id')]::smallint[]
          )
        )
        and exists (
          select 1 from pg_constraint c
          where c.conrelid = to_regclass('public.notification_jobs')
            and c.contype = 'f' and c.convalidated and not c.condeferrable
            and c.confrelid = to_regclass('public.notification_templates')
            and c.confdeltype = 'a' and c.confupdtype = 'a'
            and c.conkey = array[(select attnum from pg_attribute
              where attrelid = c.conrelid and attname = 'template_id')]::smallint[]
            and c.confkey = array[(select attnum from pg_attribute
              where attrelid = c.confrelid and attname = 'id')]::smallint[]
        ) as notification_outbox_contract,
      coalesce((select valid from column_contracts where table_name = 'recommendations'), false)
        and not exists (
          select 1 from information_schema.columns
          where table_schema='public' and table_name='recommendations'
            and column_name='rating' and is_nullable <> 'YES'
        )
        and exists (
          select 1 from pg_constraint c
          where c.conrelid=to_regclass('public.recommendations')
            and c.contype='p' and c.convalidated and not c.condeferrable
            and c.conkey=array[(select attnum from pg_attribute
              where attrelid=c.conrelid and attname='id')]::smallint[]
        ) as recommendation_runtime_contract,
      coalesce((select valid from column_contracts where table_name = 'contractors'), false)
        as contractor_recommendation_columns,
      coalesce((select valid from column_contracts where table_name = 'notifications'), false)
        and coalesce((select valid from column_contracts where table_name = 'notification_preferences'), false)
        and coalesce((select valid from column_contracts where table_name = 'notification_delivery_log'), false)
        and not exists (
          select 1 from (values ('notification_id', 'notifications'), ('user_id', 'users')) required(local_column, foreign_table)
          where not exists (
            select 1 from pg_constraint c
            where c.conrelid = to_regclass('public.notification_delivery_log')
              and c.contype = 'f' and c.convalidated and c.confdeltype = 'c'
              and c.confrelid = to_regclass('public.' || required.foreign_table)
              and c.conkey = array[(select attnum from pg_attribute
                where attrelid = c.conrelid and attname = required.local_column)]::smallint[]
              and c.confkey = array[(select attnum from pg_attribute
                where attrelid = c.confrelid and attname = 'id')]::smallint[]
          )
        )
        and exists (
          select 1 from pg_constraint c
          where c.conrelid = to_regclass('public.notification_preferences')
            and c.contype = 'f' and c.convalidated
            and c.confrelid = to_regclass('public.users') and c.confdeltype = 'c'
            and c.conkey = array[(select attnum from pg_attribute
              where attrelid = c.conrelid and attname = 'user_id')]::smallint[]
            and c.confkey = array[(select attnum from pg_attribute
              where attrelid = c.confrelid and attname = 'id')]::smallint[]
        )
        and not exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'notifications'
            and column_name = 'content' and is_nullable = 'NO'
        ) as notification_runtime_columns,
      coalesce((select valid from column_contracts where table_name = 'user_privacy_settings'), false)
        and exists (
          select 1 from pg_constraint c
          where c.conrelid = to_regclass('public.user_privacy_settings')
            and c.contype = 'p'
            and c.conkey = array[(select attnum from pg_attribute
              where attrelid = c.conrelid and attname = 'id')]::smallint[]
        )
        and exists (
          select 1 from pg_constraint c
          where c.conrelid = to_regclass('public.user_privacy_settings')
            and c.contype = 'f' and c.convalidated
            and c.confrelid = to_regclass('public.users')
            and c.confdeltype = 'a'
            and c.conkey = array[(select attnum from pg_attribute
              where attrelid = c.conrelid and attname = 'user_id')]::smallint[]
            and c.confkey = array[(select attnum from pg_attribute
              where attrelid = c.confrelid and attname = 'id')]::smallint[]
        ) as user_privacy_settings_contract,
      to_regclass('public.ts_publication_rules') is not null as publication_rules,
      to_regclass('public.ts_seo_prune_log') is not null as seo_prune_log,
      to_regclass('public.ts_public_activity') is not null as public_activity,
      to_regclass('public.profile_accounts') is not null as profile_accounts,
      to_regclass('public.profile_account_entitlements') is not null as profile_account_entitlements,
      to_regclass('public.admin_live_stream_snapshots') is not null as admin_live_stream_snapshots,
      to_regclass('public.admin_live_stream_snapshot_history') is not null as admin_live_stream_snapshot_history,
      to_regclass('public.managed_partner_intakes') is not null as managed_partner_intakes,
      to_regclass('public.profile_booking_requests') is not null as profile_booking_requests,
      to_regclass('public.profiles') is not null as profiles,
      to_regclass('public.realtor_profiles') is not null as realtor_profiles,
      to_regclass('public.car_salesman_profiles') is not null as car_salesman_profiles,
      to_regclass('drizzle.__drizzle_migrations') is not null as migration_ledger,
      exists (
        select 1
        from pg_constraint constraint_record
        join pg_class relation on relation.oid = constraint_record.conrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        where namespace.nspname = 'public'
          and relation.relname = 'documents'
          and relation.relkind in ('r', 'p')
          and constraint_record.conname = 'documents_job_id_no_synthetic_accounting_check'
          and constraint_record.contype = 'c'
          and constraint_record.convalidated
          and not constraint_record.condeferrable
          and not constraint_record.condeferred
          and not constraint_record.connoinherit
          and obj_description(constraint_record.oid, 'pg_constraint') = 'tradescout-schema:0130:v1'
          and position('job_id' in lower(pg_get_constraintdef(constraint_record.oid, true))) > 0
          and position('is null' in lower(pg_get_constraintdef(constraint_record.oid, true))) > 0
          and position('left(' in replace(lower(pg_get_constraintdef(constraint_record.oid, true)), '"left"', 'left')) > 0
          and position(', 5)' in lower(pg_get_constraintdef(constraint_record.oid, true))) > 0
          and position('<>' in lower(pg_get_constraintdef(constraint_record.oid, true))) > 0
          and position('''acct_''' in lower(pg_get_constraintdef(constraint_record.oid, true))) > 0
          and position('~~' in lower(pg_get_constraintdef(constraint_record.oid, true))) = 0
      ) as document_accounting_job_id_invariant_contract,
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
      coalesce((select valid from column_contracts where table_name = 'profile_booking_requests'), false)
        and coalesce((select valid from constraint_contracts where table_name = 'profile_booking_requests'), false)
        and coalesce((select valid from index_contracts where table_name = 'profile_booking_requests'), false)
        as profile_booking_requests_lineage_contract,
      exists (
        select 1
        from pg_trigger trigger_record
        join pg_class relation on relation.oid = trigger_record.tgrelid
        join pg_namespace namespace on namespace.oid = relation.relnamespace
        join pg_proc procedure_record on procedure_record.oid = trigger_record.tgfoid
        join pg_namespace procedure_namespace on procedure_namespace.oid = procedure_record.pronamespace
        where namespace.nspname = 'public'
          and relation.relname = 'profile_booking_requests'
          and trigger_record.tgname = 'profile_booking_requests_lineage_immutability_trigger'
          and not trigger_record.tgisinternal
          and trigger_record.tgenabled = 'O'
          and trigger_record.tgtype = 23
          and trigger_record.tgnargs = 0
          and trigger_record.tgqual is null
          and trigger_record.tgconstraint = 0
          and obj_description(trigger_record.oid, 'pg_trigger') = 'tradescout-schema:0128:v4'
          and procedure_namespace.nspname = 'public'
          and procedure_record.proname = 'enforce_profile_booking_request_lineage_immutability'
          and procedure_record.pronargs = 0
          and procedure_record.prorettype = 'trigger'::regtype
          and obj_description(procedure_record.oid, 'pg_proc') = 'tradescout-schema:0128:v4'
          and (
            select array_agg(attribute.attname::text order by attribute.attname::text)
            from unnest(trigger_record.tgattr) with ordinality trigger_column(attnum, ordinality)
            join pg_attribute attribute
              on attribute.attrelid = relation.oid
             and attribute.attnum = trigger_column.attnum
          ) = array['lineage_kind', 'owner_user_id', 'profile_id', 'requester_user_id']::text[]
          and trim(regexp_replace(
            procedure_record.prosrc,
            '[[:space:]]+',
            ' ',
            'g'
          )) = $2
      ) as profile_booking_requests_lineage_immutability_trigger,
      coalesce((select valid from column_contracts where table_name = 'profiles'), false)
        as profile_publication_authority_contract,
      coalesce((select valid from column_contracts where table_name = 'realtor_profiles'), false)
        and coalesce((select valid from constraint_contracts where table_name = 'realtor_profiles'), false)
        and coalesce((select valid from index_contracts where table_name = 'realtor_profiles'), false)
        as realtor_profiles_integrity_contract,
      coalesce((select valid from column_contracts where table_name = 'car_salesman_profiles'), false)
        and coalesce((select valid from constraint_contracts where table_name = 'car_salesman_profiles'), false)
        and coalesce((select valid from index_contracts where table_name = 'car_salesman_profiles'), false)
        as car_salesman_profiles_integrity_contract,
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
  `,
    [PROFILE_ACCOUNT_IDENTITY_FUNCTION_BODY, PROFILE_BOOKING_LINEAGE_FUNCTION_BODY]
  );
  const row = schemaResult.rows?.[0] || {};
  const check = {
    recommendationRuntimeContract: Boolean(row.recommendation_runtime_contract),
    recommendationRuntimeSchemaMigrationRecorded: false,
    contractorRecommendationColumns: Boolean(row.contractor_recommendation_columns),
    notificationRuntimeColumns: Boolean(row.notification_runtime_columns),
    notificationOutboxContract: Boolean(row.notification_outbox_contract),
    notificationOutboxMigrationRecorded: false,
    userPrivacySettingsContract: Boolean(row.user_privacy_settings_contract),
    contactRuntimeSchemaMigrationRecorded: false,
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
    profileBookingRequests: Boolean(row.profile_booking_requests),
    profileBookingRequestsLineageContract: Boolean(row.profile_booking_requests_lineage_contract),
    profileBookingRequestsLineageImmutabilityTrigger: Boolean(
      row.profile_booking_requests_lineage_immutability_trigger
    ),
    profilePublicationAuthorityContract: Boolean(row.profile_publication_authority_contract),
    realtorProfiles: Boolean(row.realtor_profiles),
    realtorProfilesIntegrityContract: Boolean(row.realtor_profiles_integrity_contract),
    carSalesmanProfiles: Boolean(row.car_salesman_profiles),
    carSalesmanProfilesIntegrityContract: Boolean(row.car_salesman_profiles_integrity_contract),
    documentAccountingJobIdInvariantContract: Boolean(
      row.document_accounting_job_id_invariant_contract
    ),
    migrationLedger: Boolean(row.migration_ledger),
    migrationRecorded: false,
    profileAccountMigrationRecorded: false,
    adminLiveStreamMigrationRecorded: false,
    managedPartnerIntakesMigrationRecorded: false,
    profileBookingLineageMigrationRecorded: false,
    professionalApplicationIntegrityMigrationRecorded: false,
    documentStandaloneLineageMigrationRecorded: false,
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
          ) as managed_partner_intakes_present,
          exists (
            select 1
            from drizzle.__drizzle_migrations
            where hash = any($5::text[])
          ) as profile_booking_lineage_present,
          exists (
            select 1
            from drizzle.__drizzle_migrations
            where hash = any($6::text[])
          ) as professional_application_integrity_present,
          exists (
            select 1
            from drizzle.__drizzle_migrations
            where hash = any($7::text[])
          ) as document_standalone_lineage_present
          , exists (
            select 1 from drizzle.__drizzle_migrations where hash = any($8::text[])
          ) as contact_runtime_schema_present,
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = any($9::text[])
          ) as notification_outbox_present,
          exists (
            select 1 from drizzle.__drizzle_migrations where hash = any($10::text[])
          ) as recommendation_runtime_schema_present
      `,
      [
        REQUIRED_MIGRATION_HASHES,
        PROFILE_ACCOUNT_MIGRATION_HASHES,
        ADMIN_LIVE_STREAM_MIGRATION_HASHES,
        MANAGED_PARTNER_INTAKES_MIGRATION_HASHES,
        PROFILE_BOOKING_LINEAGE_MIGRATION_HASHES,
        PROFESSIONAL_APPLICATION_INTEGRITY_MIGRATION_HASHES,
        DOCUMENT_STANDALONE_LINEAGE_MIGRATION_HASHES,
        CONTACT_RUNTIME_SCHEMA_MIGRATION_HASHES,
        NOTIFICATION_OUTBOX_MIGRATION_HASHES,
        RECOMMENDATION_RUNTIME_SCHEMA_MIGRATION_HASHES,
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
    check.profileBookingLineageMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.profile_booking_lineage_present
    );
    check.professionalApplicationIntegrityMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.professional_application_integrity_present
    );
    check.documentStandaloneLineageMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.document_standalone_lineage_present
    );
    check.notificationOutboxMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.notification_outbox_present
    );
    check.contactRuntimeSchemaMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.contact_runtime_schema_present
    );
    check.recommendationRuntimeSchemaMigrationRecorded = Boolean(
      migrationResult.rows?.[0]?.recommendation_runtime_schema_present
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
        DATABASE_RECOVERY_GUIDANCE,
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
