-- Bind accepted Direct Connect responses to the exact assignment/provider.
-- Historical unbound rows remain readable for non-workspace surfaces but fail
-- closed for job/financial workspace authority.

DO $$
BEGIN
  IF to_regclass('public.direct_connect_contractor_responses') IS NOT NULL THEN
    ALTER TABLE direct_connect_contractor_responses
      ADD COLUMN IF NOT EXISTS assignment_id text,
      ADD COLUMN IF NOT EXISTS provider_key text;

    CREATE INDEX IF NOT EXISTS idx_dc_contractor_responses_assignment_binding
      ON direct_connect_contractor_responses(
        request_id,
        assignment_id,
        provider_key,
        created_at DESC
      )
      WHERE assignment_id IS NOT NULL AND provider_key IS NOT NULL;
  END IF;
END
$$;
