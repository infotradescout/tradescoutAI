-- Badge awards per user (engine-owned)
CREATE TABLE IF NOT EXISTS "user_badges" (
  "user_id" varchar NOT NULL,
  "badge_id" text NOT NULL,
  "awarded_at" timestamp NOT NULL DEFAULT now(),
  "source" text NOT NULL DEFAULT 'engine',
  PRIMARY KEY ("user_id", "badge_id")
);

CREATE INDEX IF NOT EXISTS "user_badges_user_idx" ON "user_badges"("user_id");

-- Optional: last evaluation cursor per badge
CREATE TABLE IF NOT EXISTS "badge_eval_state" (
  "user_id" varchar NOT NULL,
  "badge_id" text NOT NULL,
  "last_evaluated_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "badge_id")
);
