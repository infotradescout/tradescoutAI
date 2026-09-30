-- Private, version-bound customer decisions. No inferred claim text or source URL
-- is copied into this table or into the customer reminder/outbox.
ALTER TABLE business_presence_plans
  ADD COLUMN fact_review_epoch integer NOT NULL DEFAULT 0 CHECK (fact_review_epoch >= 0),
  ADD COLUMN fact_task_reconciled_revision integer,
  ADD COLUMN fact_task_reconciled_epoch integer;

CREATE INDEX business_presence_plan_fact_task_pending_idx ON business_presence_plans (id)
  WHERE fact_task_reconciled_revision IS DISTINCT FROM revision
     OR fact_task_reconciled_epoch IS DISTINCT FROM fact_review_epoch;

CREATE TABLE business_presence_fact_decisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id varchar NOT NULL REFERENCES business_presence_plans(id) ON DELETE CASCADE,
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  profile_id varchar NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  evidence_digest varchar(64) NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
  plan_hash varchar(64) NOT NULL CHECK (plan_hash ~ '^[a-f0-9]{64}$'),
  fact_key varchar(64) NOT NULL CHECK (fact_key ~ '^(description|about|service:([0-9]|[12][0-9]))$'),
  value_digest varchar(64) NOT NULL CHECK (value_digest ~ '^[a-f0-9]{64}$'),
  decision varchar(16) NOT NULL CHECK (decision IN ('approve', 'reject', 'withdraw')),
  decision_epoch integer NOT NULL CHECK (decision_epoch > 0),
  idempotency_key varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presence_fact_decision_request_uq UNIQUE (owner_user_id, business_id, idempotency_key),
  CONSTRAINT presence_fact_decision_epoch_uq UNIQUE (plan_id, decision_epoch)
);
CREATE INDEX presence_fact_decision_current_idx ON business_presence_fact_decisions
  (plan_id, revision, fact_key, decision_epoch DESC);

ALTER TABLE business_presence_customer_tasks
  DROP CONSTRAINT business_presence_customer_tasks_kind_check;
ALTER TABLE business_presence_customer_tasks
  ADD CONSTRAINT presence_customer_task_kind_check
  CHECK (kind IN ('select_site_path', 'confirm_facts'));
-- A -> B -> A can revisit the same hash at a new plan revision. It needs a
-- fresh task rather than reviving the stale task from the first A.
ALTER TABLE business_presence_customer_tasks
  DROP CONSTRAINT presence_customer_task_version_uq;
ALTER TABLE business_presence_customer_tasks
  ADD CONSTRAINT presence_customer_task_version_uq
  UNIQUE (owner_user_id, business_id, profile_id, plan_hash, revision, kind);
INSERT INTO business_presence_task_runtime (id) VALUES ('confirm_facts') ON CONFLICT (id) DO NOTHING;

-- Cascading a fact task retires its visible in-app reminders in the same
-- transaction, just as the existing site-path task does.
CREATE OR REPLACE FUNCTION archive_presence_customer_task_notifications_on_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE notifications
  SET is_archived = true,
      archived_at = COALESCE(archived_at, now()),
      updated_at = now()
  WHERE user_id = OLD.owner_user_id
    AND group_id = CASE OLD.kind
      WHEN 'confirm_facts' THEN 'presence-facts:' || OLD.id
      ELSE 'presence-site-path:' || OLD.id
    END
    AND is_archived IS DISTINCT FROM true;
  RETURN OLD;
END;
$$;
