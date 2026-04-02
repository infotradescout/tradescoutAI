-- Deprecate legacy authority_gate value "user_search"
-- Keep interaction contract aligned to decision_card/scout_recommendation only.

-- This repo has seen environments where `marketplace_conversations.authority_gate` never existed.
-- In those cases, this migration should be a safe no-op.
DO $$
DECLARE
  constraint_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketplace_conversations'
      AND column_name = 'authority_gate'
  ) THEN
    RAISE NOTICE 'Skipping authority_gate deprecation: marketplace_conversations.authority_gate does not exist.';
    RETURN;
  END IF;

  -- Normalize existing legacy rows before tightening constraints.
  UPDATE marketplace_conversations
  SET authority_gate = 'scout_recommendation'
  WHERE authority_gate = 'user_search';

  -- Replace any existing authority_gate check constraints with the new allowlist.
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'marketplace_conversations'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%authority_gate%'
  LOOP
    EXECUTE format('ALTER TABLE marketplace_conversations DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  ALTER TABLE marketplace_conversations
  ADD CONSTRAINT marketplace_conversations_authority_gate_check
  CHECK (authority_gate IN ('decision_card', 'scout_recommendation'));

  COMMENT ON COLUMN marketplace_conversations.authority_gate IS
    'How contact was authorized (decision_card or scout_recommendation)';
END $$;
