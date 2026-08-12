-- JW Stone Express is an isolated customer identity and private-offer domain.
-- No table in this migration references TradeScout users or platform sessions.

CREATE TABLE "jw_stone_express_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" varchar(24) DEFAULT 'active' NOT NULL,
  "legal_name" varchar(160),
  "display_name" varchar(160),
  "email_normalized" varchar(320),
  "phone_normalized" varchar(32),
  "is_business" boolean,
  "business_name" varchar(160),
  "password_hash" text,
  "email_verified_at" timestamptz,
  "closed_at" timestamptz,
  "closure_pseudonym" char(64),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "jw_stone_express_accounts_status_check"
    CHECK ("status" IN ('active', 'closed')),
  CONSTRAINT "jw_stone_express_accounts_active_identity_check"
    CHECK (
      "status" <> 'active'
      OR (
        "legal_name" IS NOT NULL
        AND "display_name" IS NOT NULL
        AND "email_normalized" IS NOT NULL
        AND "phone_normalized" IS NOT NULL
        AND "is_business" IS NOT NULL
        AND "password_hash" IS NOT NULL
        AND "closed_at" IS NULL
        AND "closure_pseudonym" IS NULL
      )
    ),
  CONSTRAINT "jw_stone_express_accounts_business_check"
    CHECK (
      ("is_business" IS TRUE AND "business_name" IS NOT NULL)
      OR ("is_business" IS FALSE AND "business_name" IS NULL)
      OR "is_business" IS NULL
    ),
  CONSTRAINT "jw_stone_express_accounts_closed_identity_check"
    CHECK (
      "status" <> 'closed'
      OR (
        "legal_name" IS NULL
        AND "display_name" IS NULL
        AND "email_normalized" IS NULL
        AND "phone_normalized" IS NULL
        AND "is_business" IS NULL
        AND "business_name" IS NULL
        AND "password_hash" IS NULL
        AND "closed_at" IS NOT NULL
        AND "closure_pseudonym" IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX "jw_stone_express_accounts_active_email_uidx"
  ON "jw_stone_express_accounts" ("email_normalized")
  WHERE "email_normalized" IS NOT NULL AND "closed_at" IS NULL;
CREATE UNIQUE INDEX "jw_stone_express_accounts_closure_pseudonym_uidx"
  ON "jw_stone_express_accounts" ("closure_pseudonym")
  WHERE "closure_pseudonym" IS NOT NULL;

CREATE TABLE "jw_stone_express_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "token_hash" char(64) NOT NULL,
  "csrf_token_hash" char(64) NOT NULL,
  "host" varchar(253) NOT NULL,
  "ip_hash" char(64),
  "expires_at" timestamptz NOT NULL,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "jw_stone_express_sessions_account_fk"
    FOREIGN KEY ("account_id") REFERENCES "jw_stone_express_accounts"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "jw_stone_express_sessions_token_hash_uidx"
  ON "jw_stone_express_sessions" ("token_hash");
CREATE INDEX "jw_stone_express_sessions_account_idx"
  ON "jw_stone_express_sessions" ("account_id", "revoked_at");
CREATE INDEX "jw_stone_express_sessions_expiry_idx"
  ON "jw_stone_express_sessions" ("expires_at");

CREATE TABLE "jw_stone_express_account_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "purpose" varchar(32) NOT NULL,
  "token_hash" char(64) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "jw_stone_express_account_tokens_account_fk"
    FOREIGN KEY ("account_id") REFERENCES "jw_stone_express_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "jw_stone_express_account_tokens_purpose_check"
    CHECK ("purpose" IN ('email_verification', 'password_reset'))
);

CREATE UNIQUE INDEX "jw_stone_express_account_tokens_token_hash_uidx"
  ON "jw_stone_express_account_tokens" ("token_hash");
CREATE UNIQUE INDEX "jw_stone_express_account_tokens_active_purpose_uidx"
  ON "jw_stone_express_account_tokens" ("account_id", "purpose")
  WHERE "consumed_at" IS NULL;
CREATE INDEX "jw_stone_express_account_tokens_expiry_idx"
  ON "jw_stone_express_account_tokens" ("expires_at");

CREATE TABLE "jw_stone_containers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "public_ref" varchar(47) NOT NULL,
  "source_ref" varchar(160) NOT NULL,
  "title" varchar(160) NOT NULL,
  "description" text NOT NULL,
  "image_url" text,
  "status" varchar(24) DEFAULT 'draft' NOT NULL,
  "accepting_offers" boolean DEFAULT true NOT NULL,
  "minimum_offer_cents" integer,
  "awarded_offer_id" uuid,
  "published_at" timestamptz,
  "closed_at" timestamptz,
  "awarded_at" timestamptz,
  "created_by_actor_id" text NOT NULL,
  "updated_by_actor_id" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "jw_stone_containers_status_check"
    CHECK ("status" IN ('draft', 'published', 'closed', 'awarded')),
  CONSTRAINT "jw_stone_containers_minimum_check"
    CHECK ("minimum_offer_cents" IS NULL OR "minimum_offer_cents" > 0),
  CONSTRAINT "jw_stone_containers_terminal_intake_check"
    CHECK ("status" NOT IN ('closed', 'awarded') OR "accepting_offers" IS FALSE),
  CONSTRAINT "jw_stone_containers_award_check"
    CHECK (
      ("status" = 'awarded' AND "awarded_offer_id" IS NOT NULL AND "awarded_at" IS NOT NULL)
      OR ("status" <> 'awarded' AND "awarded_offer_id" IS NULL AND "awarded_at" IS NULL)
    )
);

CREATE UNIQUE INDEX "jw_stone_containers_public_ref_uidx"
  ON "jw_stone_containers" ("public_ref");
CREATE UNIQUE INDEX "jw_stone_containers_source_ref_uidx"
  ON "jw_stone_containers" ("source_ref");
CREATE INDEX "jw_stone_containers_public_status_idx"
  ON "jw_stone_containers" ("status", "created_at");

CREATE TABLE "jw_stone_offer_settings" (
  "stone_source_ref" varchar(160) PRIMARY KEY NOT NULL,
  "stone_public_ref" varchar(47) NOT NULL,
  "accepting_offers" boolean DEFAULT true NOT NULL,
  "minimum_offer_cents" integer,
  "updated_by_actor_id" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "jw_stone_offer_settings_minimum_check"
    CHECK ("minimum_offer_cents" IS NULL OR "minimum_offer_cents" > 0)
);

CREATE UNIQUE INDEX "jw_stone_offer_settings_public_ref_uidx"
  ON "jw_stone_offer_settings" ("stone_public_ref");

CREATE TABLE "jw_stone_private_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid,
  "closure_pseudonym" char(64),
  "target_kind" varchar(16) NOT NULL,
  "target_ref" varchar(47) NOT NULL,
  "stone_source_ref" varchar(160),
  "container_id" uuid,
  "current_version_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "jw_stone_private_offers_account_fk"
    FOREIGN KEY ("account_id") REFERENCES "jw_stone_express_accounts"("id") ON DELETE SET NULL,
  CONSTRAINT "jw_stone_private_offers_container_fk"
    FOREIGN KEY ("container_id") REFERENCES "jw_stone_containers"("id") ON DELETE RESTRICT,
  CONSTRAINT "jw_stone_private_offers_target_kind_check"
    CHECK ("target_kind" IN ('stone', 'container')),
  CONSTRAINT "jw_stone_private_offers_target_shape_check"
    CHECK (
      ("target_kind" = 'stone' AND "stone_source_ref" IS NOT NULL AND "container_id" IS NULL)
      OR ("target_kind" = 'container' AND "stone_source_ref" IS NULL AND "container_id" IS NOT NULL)
    ),
  CONSTRAINT "jw_stone_private_offers_owner_check"
    CHECK (
      ("account_id" IS NOT NULL AND "closure_pseudonym" IS NULL)
      OR ("account_id" IS NULL AND "closure_pseudonym" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "jw_stone_private_offers_account_target_uidx"
  ON "jw_stone_private_offers" ("account_id", "target_kind", "target_ref")
  WHERE "account_id" IS NOT NULL;
CREATE INDEX "jw_stone_private_offers_container_idx"
  ON "jw_stone_private_offers" ("container_id");
CREATE INDEX "jw_stone_private_offers_current_version_idx"
  ON "jw_stone_private_offers" ("current_version_id");

CREATE TABLE "jw_stone_private_offer_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "offer_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "state" varchar(32) NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" char(3) DEFAULT 'USD' NOT NULL,
  "submitted_at" timestamptz,
  "supersedes_version_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "jw_stone_private_offer_versions_offer_fk"
    FOREIGN KEY ("offer_id") REFERENCES "jw_stone_private_offers"("id") ON DELETE RESTRICT,
  CONSTRAINT "jw_stone_private_offer_versions_supersedes_fk"
    FOREIGN KEY ("supersedes_version_id") REFERENCES "jw_stone_private_offer_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "jw_stone_private_offer_versions_number_check"
    CHECK ("version_number" > 0),
  CONSTRAINT "jw_stone_private_offer_versions_amount_check"
    CHECK ("amount_cents" > 0),
  CONSTRAINT "jw_stone_private_offer_versions_currency_check"
    CHECK ("currency" = 'USD'),
  CONSTRAINT "jw_stone_private_offer_versions_state_check"
    CHECK ("state" IN ('pending_verification', 'submitted', 'under_review', 'accepted', 'declined', 'withdrawn', 'expired')),
  CONSTRAINT "jw_stone_private_offer_versions_submission_check"
    CHECK (
      ("state" = 'pending_verification' AND "submitted_at" IS NULL)
      OR ("state" IN ('submitted', 'under_review', 'accepted', 'declined', 'expired') AND "submitted_at" IS NOT NULL)
      OR "state" = 'withdrawn'
    )
);

CREATE UNIQUE INDEX "jw_stone_private_offer_versions_offer_number_uidx"
  ON "jw_stone_private_offer_versions" ("offer_id", "version_number");
CREATE INDEX "jw_stone_private_offer_versions_priority_idx"
  ON "jw_stone_private_offer_versions" ("state", "amount_cents" DESC, "submitted_at", "id");

ALTER TABLE "jw_stone_private_offers"
  ADD CONSTRAINT "jw_stone_private_offers_current_version_fk"
  FOREIGN KEY ("current_version_id")
  REFERENCES "jw_stone_private_offer_versions"("id")
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "jw_stone_containers"
  ADD CONSTRAINT "jw_stone_containers_awarded_offer_fk"
  FOREIGN KEY ("awarded_offer_id")
  REFERENCES "jw_stone_private_offers"("id")
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE "jw_stone_offer_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "offer_id" uuid NOT NULL,
  "version_id" uuid,
  "event_type" varchar(64) NOT NULL,
  "actor_kind" varchar(16) NOT NULL,
  "actor_ref" text,
  "note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "jw_stone_offer_events_offer_fk"
    FOREIGN KEY ("offer_id") REFERENCES "jw_stone_private_offers"("id") ON DELETE RESTRICT,
  CONSTRAINT "jw_stone_offer_events_version_fk"
    FOREIGN KEY ("version_id") REFERENCES "jw_stone_private_offer_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "jw_stone_offer_events_actor_kind_check"
    CHECK ("actor_kind" IN ('requester', 'operator', 'system')),
  CONSTRAINT "jw_stone_offer_events_actor_ref_check"
    CHECK (
      ("actor_kind" = 'operator' AND "actor_ref" IS NOT NULL)
      OR ("actor_kind" <> 'operator' AND "actor_ref" IS NULL)
    )
);

CREATE INDEX "jw_stone_offer_events_offer_time_idx"
  ON "jw_stone_offer_events" ("offer_id", "created_at", "id");

CREATE TABLE "jw_stone_idempotency_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid,
  "account_scope_hash" char(64) NOT NULL,
  "operation" varchar(64) NOT NULL,
  "target_kind" varchar(24) NOT NULL,
  "target_ref" varchar(160) NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "request_hash" char(64) NOT NULL,
  "response_status" integer NOT NULL,
  "response_body" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz NOT NULL,
  CONSTRAINT "jw_stone_idempotency_receipts_account_fk"
    FOREIGN KEY ("account_id") REFERENCES "jw_stone_express_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "jw_stone_idempotency_receipts_status_check"
    CHECK ("response_status" BETWEEN 100 AND 599)
);

CREATE UNIQUE INDEX "jw_stone_idempotency_receipts_scope_uidx"
  ON "jw_stone_idempotency_receipts" (
    "account_scope_hash",
    "operation",
    "target_kind",
    "target_ref",
    "idempotency_key"
  );
CREATE INDEX "jw_stone_idempotency_receipts_expiry_idx"
  ON "jw_stone_idempotency_receipts" ("expires_at");

CREATE TABLE "jw_stone_email_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid,
  "offer_id" uuid,
  "retry_of_id" uuid,
  "purpose" varchar(64) NOT NULL,
  "recipient_normalized" varchar(320) NOT NULL,
  "template_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "secret_envelope" jsonb,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "available_at" timestamptz DEFAULT now() NOT NULL,
  "claim_id" uuid,
  "claimed_at" timestamptz,
  "claim_expires_at" timestamptz,
  "sent_at" timestamptz,
  "failed_at" timestamptz,
  "cancelled_at" timestamptz,
  "provider_message_id" text,
  "last_error_summary" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "jw_stone_email_outbox_account_fk"
    FOREIGN KEY ("account_id") REFERENCES "jw_stone_express_accounts"("id") ON DELETE SET NULL,
  CONSTRAINT "jw_stone_email_outbox_offer_fk"
    FOREIGN KEY ("offer_id") REFERENCES "jw_stone_private_offers"("id") ON DELETE SET NULL,
  CONSTRAINT "jw_stone_email_outbox_retry_fk"
    FOREIGN KEY ("retry_of_id") REFERENCES "jw_stone_email_outbox"("id") ON DELETE SET NULL,
  CONSTRAINT "jw_stone_email_outbox_purpose_check"
    CHECK (
      "purpose" IN (
        'jw_stone_express_verification',
        'jw_stone_express_password_reset',
        'jw_stone_offer_confirmation',
        'jw_stone_offer_staff_alert',
        'jw_stone_offer_status'
      )
    ),
  CONSTRAINT "jw_stone_email_outbox_status_check"
    CHECK ("status" IN ('pending', 'processing', 'retry', 'sent', 'failed', 'cancelled')),
  CONSTRAINT "jw_stone_email_outbox_attempt_count_check"
    CHECK ("attempt_count" BETWEEN 0 AND 6),
  CONSTRAINT "jw_stone_email_outbox_claim_check"
    CHECK (
      (
        "status" = 'processing'
        AND "claim_id" IS NOT NULL
        AND "claimed_at" IS NOT NULL
        AND "claim_expires_at" IS NOT NULL
      )
      OR (
        "status" <> 'processing'
        AND "claim_id" IS NULL
        AND "claimed_at" IS NULL
        AND "claim_expires_at" IS NULL
      )
    )
);

CREATE INDEX "jw_stone_email_outbox_due_idx"
  ON "jw_stone_email_outbox" ("available_at", "id")
  WHERE "status" IN ('pending', 'retry');
CREATE INDEX "jw_stone_email_outbox_account_idx"
  ON "jw_stone_email_outbox" ("account_id", "created_at");
CREATE INDEX "jw_stone_email_outbox_offer_idx"
  ON "jw_stone_email_outbox" ("offer_id", "created_at");

CREATE TABLE "jw_stone_email_outbox_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "outbox_id" uuid NOT NULL,
  "attempt_number" integer NOT NULL,
  "claim_id" uuid NOT NULL,
  "status" varchar(24) NOT NULL,
  "provider_message_id" text,
  "error_summary" text,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz,
  CONSTRAINT "jw_stone_email_outbox_attempts_outbox_fk"
    FOREIGN KEY ("outbox_id") REFERENCES "jw_stone_email_outbox"("id") ON DELETE CASCADE,
  CONSTRAINT "jw_stone_email_outbox_attempts_number_check"
    CHECK ("attempt_number" > 0),
  CONSTRAINT "jw_stone_email_outbox_attempts_status_check"
    CHECK ("status" IN ('processing', 'sent', 'failed'))
);

CREATE UNIQUE INDEX "jw_stone_email_outbox_attempts_number_uidx"
  ON "jw_stone_email_outbox_attempts" ("outbox_id", "attempt_number");
CREATE UNIQUE INDEX "jw_stone_email_outbox_attempts_claim_uidx"
  ON "jw_stone_email_outbox_attempts" ("claim_id");

CREATE OR REPLACE FUNCTION "jw_stone_validate_offer_version_insert"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_version uuid;
  superseded_offer uuid;
  superseded_number integer;
BEGIN
  SELECT "current_version_id"
  INTO current_version
  FROM "jw_stone_private_offers"
  WHERE "id" = NEW."offer_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JW Stone offer does not exist';
  END IF;

  IF NEW."supersedes_version_id" IS NULL THEN
    IF current_version IS NOT NULL OR NEW."version_number" <> 1 THEN
      RAISE EXCEPTION 'First JW Stone offer version must be version 1';
    END IF;
    RETURN NEW;
  END IF;

  SELECT "offer_id", "version_number"
  INTO superseded_offer, superseded_number
  FROM "jw_stone_private_offer_versions"
  WHERE "id" = NEW."supersedes_version_id";

  IF superseded_offer IS DISTINCT FROM NEW."offer_id"
     OR current_version IS DISTINCT FROM NEW."supersedes_version_id"
     OR NEW."version_number" <> superseded_number + 1 THEN
    RAISE EXCEPTION 'JW Stone offer version does not supersede the current version';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "jw_stone_private_offer_versions_insert_guard"
BEFORE INSERT ON "jw_stone_private_offer_versions"
FOR EACH ROW EXECUTE FUNCTION "jw_stone_validate_offer_version_insert"();

CREATE OR REPLACE FUNCTION "jw_stone_reject_immutable_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'JW Stone immutable records cannot be updated or deleted';
END;
$$;

CREATE TRIGGER "jw_stone_private_offer_versions_immutable_guard"
BEFORE UPDATE OR DELETE ON "jw_stone_private_offer_versions"
FOR EACH ROW EXECUTE FUNCTION "jw_stone_reject_immutable_mutation"();

CREATE TRIGGER "jw_stone_offer_events_immutable_guard"
BEFORE UPDATE OR DELETE ON "jw_stone_offer_events"
FOR EACH ROW EXECUTE FUNCTION "jw_stone_reject_immutable_mutation"();

CREATE OR REPLACE FUNCTION "jw_stone_validate_current_version"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."current_version_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "jw_stone_private_offer_versions" v
    WHERE v."id" = NEW."current_version_id"
      AND v."offer_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'JW Stone current version must belong to its offer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "jw_stone_private_offers_current_version_guard"
AFTER INSERT OR UPDATE OF "current_version_id" ON "jw_stone_private_offers"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "jw_stone_validate_current_version"();

CREATE OR REPLACE FUNCTION "jw_stone_validate_container_award"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."status" = 'awarded' AND NOT EXISTS (
    SELECT 1
    FROM "jw_stone_private_offers" o
    INNER JOIN "jw_stone_private_offer_versions" v
      ON v."id" = o."current_version_id"
    WHERE o."id" = NEW."awarded_offer_id"
      AND o."container_id" = NEW."id"
      AND v."state" = 'accepted'
  ) THEN
    RAISE EXCEPTION 'JW Stone container award must reference its accepted offer';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "jw_stone_containers_award_guard"
AFTER INSERT OR UPDATE OF "status", "awarded_offer_id" ON "jw_stone_containers"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "jw_stone_validate_container_award"();
