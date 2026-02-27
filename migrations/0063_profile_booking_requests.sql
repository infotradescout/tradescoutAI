CREATE TABLE IF NOT EXISTS profile_booking_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'requested',
  request_message text,
  service_label varchar(120),
  requested_start_at timestamp,
  requested_end_at timestamp,
  timezone varchar(80),
  delivery_mode varchar DEFAULT 'onsite',
  location_note text,
  deposit_required boolean NOT NULL DEFAULT false,
  deposit_amount_usd numeric(10,2),
  payment_status varchar NOT NULL DEFAULT 'none',
  payment_intent_id varchar(120),
  booking_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT profile_booking_requests_status_chk
    CHECK (status IN ('requested', 'accepted', 'declined', 'cancelled', 'completed')),
  CONSTRAINT profile_booking_requests_delivery_mode_chk
    CHECK (delivery_mode IN ('mobile', 'remote', 'onsite')),
  CONSTRAINT profile_booking_requests_payment_status_chk
    CHECK (payment_status IN ('none', 'requires_payment', 'processing', 'paid', 'failed', 'refunded'))
);

CREATE INDEX IF NOT EXISTS idx_profile_booking_requests_owner
  ON profile_booking_requests(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_profile_booking_requests_requester
  ON profile_booking_requests(requester_user_id);

CREATE INDEX IF NOT EXISTS idx_profile_booking_requests_status
  ON profile_booking_requests(status);

CREATE INDEX IF NOT EXISTS idx_profile_booking_requests_created_at
  ON profile_booking_requests(created_at DESC);
