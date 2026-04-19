-- Migration 0086: Add pending_outcome status to work_requests
-- The work_requests.status column uses a varchar enum constraint.
-- We add 'pending_outcome' between 'in_progress' and 'completed' to represent
-- the stage where the requester has marked the work as done on their end but
-- is waiting for confirmation from the provider (or vice versa).

-- No ALTER TYPE needed since status is varchar with inline enum, not a pgEnum.
-- The DB will accept the new value once the application starts writing it.
-- This migration is a no-op at the DB level but documents the intent.
SELECT 1; -- intentional no-op; varchar enum is enforced at app layer only
