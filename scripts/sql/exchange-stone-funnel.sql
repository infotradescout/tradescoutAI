-- Candidate schema, not registered as an automatic migration yet.
-- Integrate with the existing verified release ledger before applying to production.
CREATE TABLE IF NOT EXISTS exchange_stone_funnel_events (
  event_key text PRIMARY KEY,
  evidence_family text NOT NULL CHECK (evidence_family IN ('browser', 'saved_inquiry', 'connected_call', 'saved_quote', 'settled_payment')),
  evidence_id text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('listing_view', 'inquiry_started', 'inquiry_submitted', 'callback_requested', 'call_connected', 'quote_sent', 'order_paid')),
  environment text NOT NULL CHECK (environment IN ('production', 'test')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment, evidence_family, evidence_id, stage),
  CHECK ((stage IN ('listing_view', 'inquiry_started') AND evidence_family = 'browser')
    OR (stage IN ('inquiry_submitted', 'callback_requested') AND evidence_family = 'saved_inquiry')
    OR (stage = 'call_connected' AND evidence_family IN ('connected_call'))
    OR (stage = 'quote_sent' AND evidence_family = 'saved_quote')
    OR (stage = 'order_paid' AND evidence_family = 'settled_payment'))
);
