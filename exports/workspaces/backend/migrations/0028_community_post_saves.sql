CREATE TABLE IF NOT EXISTS "community_post_saves" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "post_id" varchar NOT NULL REFERENCES "community_posts"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "community_post_saves_user_post_uidx"
  ON "community_post_saves"("user_id", "post_id");

CREATE INDEX IF NOT EXISTS "idx_community_post_saves_user"
  ON "community_post_saves"("user_id");

CREATE INDEX IF NOT EXISTS "idx_community_post_saves_post"
  ON "community_post_saves"("post_id");

