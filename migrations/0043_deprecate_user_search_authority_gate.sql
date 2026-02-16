-- Deprecate legacy authority_gate value "user_search"
-- Keep interaction contract aligned to decision_card/scout_recommendation only.

BEGIN;

-- Normalize existing legacy rows before tightening constraints.
UPDATE marketplace_conversations
SET authority_gate = 'scout_recommendation'
WHERE authority_gate = 'user_search';

-- Replace any existing authority_gate check constraints with the new allowlist.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'marketplace_conversations'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%authority_gate%'
  LOOP
    EXECUTE format('ALTER TABLE marketplace_conversations DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE marketplace_conversations
ADD CONSTRAINT marketplace_conversations_authority_gate_check
CHECK (authority_gate IN ('decision_card', 'scout_recommendation'));

COMMENT ON COLUMN marketplace_conversations.authority_gate IS
  'How contact was authorized (decision_card or scout_recommendation)';

COMMIT;
