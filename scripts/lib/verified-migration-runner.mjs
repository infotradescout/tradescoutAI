export const DATABASE_RECOVERY_GUIDANCE = [
  "An empty or incomplete database is not an existing-schema recovery target.",
  "First establish the approved base schema and its dependencies, including users, businesses, user_profiles and profiles; a migration-ledger marker is not a baseline.",
  "Never stamp SQL that did not execute, infer a whole migration from one duplicate object, or run a full schema push against a real database.",
  "For an existing database, inspect the missing objects and journal gaps, reconcile drift to the committed definitions, and execute only the reviewed applicable canonical SQL before recording it.",
  "The required-schema recovery sequence includes migrations/0072_seo_publication_rules_and_freshness.sql, migrations/0115_profile_accounts.sql, migrations/0116_admin_live_stream_snapshots.sql, migrations/0117_managed_partner_intakes.sql, migrations/0118_profile_account_public_routes.sql, and migrations/0130_business_managed_partner_contact.sql.",
  "0118 must follow any replay of 0115, even when an older ledger entry for 0118 already exists: 0115 restores predecessor path constraints.",
  "Keep current successor constraints, indexes and triggers; preserve LF/CRLF-compatible migration identities.",
  "This sequence is not a complete empty-database bootstrap recipe. See docs/runbooks/DB_MIGRATE_FILL_GAPS.md, then rerun npm run db:migrate and npm run db:verify:required.",
  "The guarded db:bootstrap:test -- --full-sync fixture is for disposable tests only and does not prove that the historical empty-database migration chain works.",
].join(" ");

/** Run SQL once, then independently prove the required schema. Never invent history. */
export async function runVerifiedMigration({ migrate, verify, report = console.error }) {
  const migrationStatus = await migrate();
  if (!Number.isInteger(migrationStatus) || migrationStatus < 0) {
    throw new Error("Migration process did not return a valid exit status");
  }
  if (migrationStatus !== 0) {
    report("[db:migrate] Migration failed. No automatic baseline, ledger stamping or success retry was performed.");
    report(DATABASE_RECOVERY_GUIDANCE);
    return migrationStatus;
  }

  const verificationStatus = await verify();
  if (!Number.isInteger(verificationStatus) || verificationStatus < 0) {
    throw new Error("Required-schema verification did not return a valid exit status");
  }
  if (verificationStatus !== 0) {
    report("[db:migrate] SQL runner exited successfully, but the required schema is not verified. Database setup FAILED; this is not a compatible release.");
    report(DATABASE_RECOVERY_GUIDANCE);
    return verificationStatus;
  }
  return 0;
}
