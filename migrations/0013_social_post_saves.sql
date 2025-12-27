CREATE TABLE IF NOT EXISTS "social_post_saves" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" varchar NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_post_saves_user_post_uidx"
  ON "social_post_saves"("user_id", "post_id");

CREATE INDEX IF NOT EXISTS "idx_social_post_saves_user"
  ON "social_post_saves"("user_id");

CREATE INDEX IF NOT EXISTS "idx_social_post_saves_post"
  ON "social_post_saves"("post_id");
