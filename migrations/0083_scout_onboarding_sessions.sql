-- Migration: 0083_scout_onboarding_sessions
-- Adds a persistent DB-backed store for Scout onboarding sessions,
-- replacing the in-memory Map that was lost on server restart.

CREATE TABLE IF NOT EXISTS "scout_onboarding_sessions" (
  "session_id"           varchar(255)  PRIMARY KEY,
  "user_id"              varchar(255)  REFERENCES "users"("id") ON DELETE CASCADE,
  "snapshot"             text          NOT NULL DEFAULT '{}',
  "answered_questions"   text          NOT NULL DEFAULT '[]',
  "skipped_questions"    text          NOT NULL DEFAULT '[]',
  "expiration_reason"    varchar(64),
  "started_at"           timestamp     NOT NULL DEFAULT NOW(),
  "expires_at"           timestamp     NOT NULL,
  "updated_at"           timestamp     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_scout_onboarding_user_id"
  ON "scout_onboarding_sessions" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_scout_onboarding_expires_at"
  ON "scout_onboarding_sessions" ("expires_at");
