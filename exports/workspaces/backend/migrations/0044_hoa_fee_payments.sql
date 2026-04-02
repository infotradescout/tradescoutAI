-- Resident-level HOA fee ledger for auditable fee collection receipts
CREATE TABLE IF NOT EXISTS hoa_fee_payments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hoa_id varchar NOT NULL REFERENCES homeowner_associations(id) ON DELETE CASCADE,
  resident_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  description text NOT NULL,
  collected_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method varchar NOT NULL DEFAULT 'manual',
  external_ref varchar,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hoa_fee_payments_hoa ON hoa_fee_payments(hoa_id);
CREATE INDEX IF NOT EXISTS idx_hoa_fee_payments_resident ON hoa_fee_payments(resident_id);
CREATE INDEX IF NOT EXISTS idx_hoa_fee_payments_created_at ON hoa_fee_payments(created_at DESC);
