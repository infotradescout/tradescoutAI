-- Canonical, private payment-event authority.
-- Stores only routing identifiers, amounts, and a payload digest; never the provider payload.

CREATE TABLE IF NOT EXISTS payment_provider_events (
  provider varchar(40) NOT NULL DEFAULT 'stripe',
  event_id varchar(255) NOT NULL,
  event_type varchar(160) NOT NULL,
  provider_object_key varchar(320) NOT NULL,
  payload_sha256 varchar(64) NOT NULL,
  livemode boolean NOT NULL DEFAULT false,
  subject_lane varchar(80),
  subject_reference varchar(255),
  metric varchar(48),
  aggregation varchar(24),
  source_object_key varchar(320),
  amount_cents bigint,
  observation_active boolean,
  alias_keys text[] NOT NULL DEFAULT '{}'::text[],
  lookup_keys text[] NOT NULL DEFAULT '{}'::text[],
  status varchar(32) NOT NULL DEFAULT 'recorded',
  dispatch_attempts integer NOT NULL DEFAULT 0,
  dispatch_claim_token uuid,
  dispatch_claim_expires_at timestamptz,
  dispatched_at timestamptz,
  last_error_code varchar(120),
  occurred_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id),
  CONSTRAINT payment_provider_events_payload_hash_check
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT payment_provider_events_subject_pair_check
    CHECK ((subject_lane IS NULL) = (subject_reference IS NULL)),
  CONSTRAINT payment_provider_events_observation_check
    CHECK (
      (metric IS NULL AND aggregation IS NULL AND source_object_key IS NULL
        AND amount_cents IS NULL AND observation_active IS NULL)
      OR
      (metric IS NOT NULL AND aggregation IN ('maximum', 'latest', 'sum_latest')
        AND source_object_key IS NOT NULL AND amount_cents >= 0
        AND observation_active IS NOT NULL)
    ),
  CONSTRAINT payment_provider_events_status_check
    CHECK (status IN ('recorded', 'unresolved', 'dispatching', 'dispatched', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_payment_provider_events_dispatch
  ON payment_provider_events (status, dispatch_claim_expires_at, recorded_at);
CREATE INDEX IF NOT EXISTS idx_payment_provider_events_subject
  ON payment_provider_events (subject_lane, subject_reference, occurred_at);
CREATE INDEX IF NOT EXISTS idx_payment_provider_events_unresolved_lookup
  ON payment_provider_events USING gin (lookup_keys)
  WHERE subject_lane IS NULL;

CREATE TABLE IF NOT EXISTS payment_money_subjects (
  lane varchar(80) NOT NULL,
  subject_reference varchar(255) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  captured_amount_cents bigint NOT NULL DEFAULT 0,
  refunded_amount_cents bigint NOT NULL DEFAULT 0,
  disputed_amount_cents bigint NOT NULL DEFAULT 0,
  transfer_reversed_amount_cents bigint NOT NULL DEFAULT 0,
  status varchar(40) NOT NULL DEFAULT 'pending',
  first_observed_at timestamptz NOT NULL,
  last_observed_at timestamptz NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lane, subject_reference),
  CONSTRAINT payment_money_subjects_amounts_check CHECK (
    captured_amount_cents >= 0
    AND refunded_amount_cents >= 0
    AND disputed_amount_cents >= 0
    AND transfer_reversed_amount_cents >= 0
  ),
  CONSTRAINT payment_money_subjects_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT payment_money_subjects_status_check CHECK (
    status IN (
      'pending', 'failed', 'captured', 'partially_refunded', 'refunded',
      'disputed', 'partially_reversed', 'reversed'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_payment_money_subjects_status
  ON payment_money_subjects (lane, status, updated_at);

CREATE TABLE IF NOT EXISTS payment_provider_objects (
  provider varchar(40) NOT NULL DEFAULT 'stripe',
  object_key varchar(320) NOT NULL,
  subject_lane varchar(80) NOT NULL,
  subject_reference varchar(255) NOT NULL,
  first_event_id varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, object_key),
  CONSTRAINT payment_provider_objects_subject_fk
    FOREIGN KEY (subject_lane, subject_reference)
    REFERENCES payment_money_subjects(lane, subject_reference)
    ON DELETE RESTRICT,
  CONSTRAINT payment_provider_objects_event_fk
    FOREIGN KEY (provider, first_event_id)
    REFERENCES payment_provider_events(provider, event_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_payment_provider_objects_subject
  ON payment_provider_objects (subject_lane, subject_reference);

CREATE TABLE IF NOT EXISTS payment_money_observations (
  provider varchar(40) NOT NULL DEFAULT 'stripe',
  event_id varchar(255) NOT NULL,
  subject_lane varchar(80) NOT NULL,
  subject_reference varchar(255) NOT NULL,
  metric varchar(48) NOT NULL,
  aggregation varchar(24) NOT NULL,
  source_object_key varchar(320) NOT NULL,
  amount_cents bigint NOT NULL,
  active boolean NOT NULL DEFAULT true,
  observed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id),
  CONSTRAINT payment_money_observations_event_fk
    FOREIGN KEY (provider, event_id)
    REFERENCES payment_provider_events(provider, event_id)
    ON DELETE RESTRICT,
  CONSTRAINT payment_money_observations_subject_fk
    FOREIGN KEY (subject_lane, subject_reference)
    REFERENCES payment_money_subjects(lane, subject_reference)
    ON DELETE RESTRICT,
  CONSTRAINT payment_money_observations_metric_check CHECK (
    metric IN (
      'capture', 'failure', 'refund_item', 'refund_total',
      'dispute', 'transfer_reversal_item', 'transfer_reversal_total'
    )
  ),
  CONSTRAINT payment_money_observations_aggregation_check
    CHECK (aggregation IN ('maximum', 'latest', 'sum_latest')),
  CONSTRAINT payment_money_observations_amount_check CHECK (amount_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_money_observations_subject
  ON payment_money_observations
  (subject_lane, subject_reference, metric, source_object_key, observed_at DESC);

CREATE OR REPLACE FUNCTION preserve_payment_provider_event_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.event_type IS DISTINCT FROM OLD.event_type
     OR NEW.provider_object_key IS DISTINCT FROM OLD.provider_object_key
     OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
     OR NEW.livemode IS DISTINCT FROM OLD.livemode
     OR NEW.metric IS DISTINCT FROM OLD.metric
     OR NEW.aggregation IS DISTINCT FROM OLD.aggregation
     OR NEW.source_object_key IS DISTINCT FROM OLD.source_object_key
     OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
     OR NEW.observation_active IS DISTINCT FROM OLD.observation_active
     OR NEW.alias_keys IS DISTINCT FROM OLD.alias_keys
     OR NEW.lookup_keys IS DISTINCT FROM OLD.lookup_keys
     OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
  THEN
    RAISE EXCEPTION 'payment provider event identity is immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payment_provider_events_identity_immutable
  ON payment_provider_events;
CREATE TRIGGER payment_provider_events_identity_immutable
BEFORE UPDATE ON payment_provider_events
FOR EACH ROW EXECUTE FUNCTION preserve_payment_provider_event_identity();

CREATE OR REPLACE FUNCTION reject_payment_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'payment audit rows are append-only';
END $$;

DROP TRIGGER IF EXISTS payment_provider_events_no_delete ON payment_provider_events;
CREATE TRIGGER payment_provider_events_no_delete
BEFORE DELETE ON payment_provider_events
FOR EACH ROW EXECUTE FUNCTION reject_payment_audit_mutation();

DROP TRIGGER IF EXISTS payment_money_observations_no_mutation ON payment_money_observations;
CREATE TRIGGER payment_money_observations_no_mutation
BEFORE UPDATE OR DELETE ON payment_money_observations
FOR EACH ROW EXECUTE FUNCTION reject_payment_audit_mutation();
