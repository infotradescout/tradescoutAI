CREATE TABLE IF NOT EXISTS "scout_conversations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "title" varchar(160) NOT NULL,
  "preview" text,
  "summary" text,
  "intent" varchar(80),
  "county_fips" varchar(5),
  "state_code" varchar(2),
  "message_count" integer DEFAULT 0 NOT NULL,
  "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "archived_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "scout_conversations_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "scout_conversations_user_updated_idx"
  ON "scout_conversations" ("user_id", "updated_at");

CREATE INDEX IF NOT EXISTS "scout_conversations_user_archived_idx"
  ON "scout_conversations" ("user_id", "archived_at");

CREATE INDEX IF NOT EXISTS "scout_conversations_county_idx"
  ON "scout_conversations" ("county_fips");
