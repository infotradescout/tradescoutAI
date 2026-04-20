-- Migration 0088: Create admin_audit_log table
-- Replaces the in-memory auditLog array in adminAuditLogService with a persistent DB table.
-- This ensures impersonation events, admin actions, and audit trails survive restarts.

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" varchar(80) NOT NULL,
  "admin_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "target_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_admin_audit_log_admin" ON "admin_audit_log" ("admin_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_admin_audit_log_target" ON "admin_audit_log" ("target_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_admin_audit_log_type" ON "admin_audit_log" ("type", "created_at");
