-- TradeScout profile-law reconstruction.
--
-- Lane-local number: 0128 (current origin/main ends at 0127).
-- Integration reservation: rename this file/journal tag to 0131 after the
-- security lane occupies 0128-0130. The SQL is forward-only and must never be
-- folded into or overwrite a historical migration.

CREATE TABLE IF NOT EXISTS public.profile_request_decision_proofs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_hash varchar(64) NOT NULL,
  session_binding_hash varchar(64) NOT NULL,
  authority_gate varchar(32) NOT NULL DEFAULT 'decision_card',
  source varchar(64) NOT NULL,
  target_profile_id varchar NOT NULL,
  target_profile_slug varchar(255) NOT NULL,
  target_business_id varchar NOT NULL,
  target_owner_user_id varchar NOT NULL,
  decision_scope text NOT NULL,
  request_payload jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending',
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  work_request_id varchar,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT profile_request_decision_proofs_profile_fk
    FOREIGN KEY (target_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT profile_request_decision_proofs_business_fk
    FOREIGN KEY (target_business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
  CONSTRAINT profile_request_decision_proofs_owner_fk
    FOREIGN KEY (target_owner_user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT profile_request_decision_proofs_work_request_fk
    FOREIGN KEY (work_request_id) REFERENCES public.work_requests(id) ON DELETE SET NULL,
  CONSTRAINT profile_request_decision_proofs_authority_check
    CHECK (authority_gate = 'decision_card'),
  CONSTRAINT profile_request_decision_proofs_source_check
    CHECK (source = 'tradepartner_profile'),
  CONSTRAINT profile_request_decision_proofs_status_check
    CHECK (status IN ('pending', 'confirmed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS profile_request_decision_proofs_hash_uidx
  ON public.profile_request_decision_proofs(proof_hash);

CREATE INDEX IF NOT EXISTS profile_request_decision_proofs_expiry_idx
  ON public.profile_request_decision_proofs(status, expires_at);

CREATE INDEX IF NOT EXISTS profile_request_decision_proofs_target_idx
  ON public.profile_request_decision_proofs(
    target_profile_id,
    target_business_id,
    target_owner_user_id
  );

COMMENT ON TABLE public.profile_request_decision_proofs IS
  'tradescout-schema:0131:v1 short-lived, one-time, session/source/target-bound public profile request authority';
