CREATE TABLE IF NOT EXISTS "user_county_vault_contribution_adjustments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "county_id" varchar REFERENCES "counties"("id") ON DELETE SET NULL,
  "direct_amount" numeric(14,2) NOT NULL DEFAULT '0',
  "network_amount" numeric(14,2) NOT NULL DEFAULT '0',
  "note" text,
  "source" varchar NOT NULL DEFAULT 'manual_adjustment',
  "created_by" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_county_vault_adj_user_idx"
  ON "user_county_vault_contribution_adjustments" ("user_id");

CREATE INDEX IF NOT EXISTS "user_county_vault_adj_county_idx"
  ON "user_county_vault_contribution_adjustments" ("county_id");

CREATE INDEX IF NOT EXISTS "user_county_vault_adj_created_idx"
  ON "user_county_vault_contribution_adjustments" ("created_at");
