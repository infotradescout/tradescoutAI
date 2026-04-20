-- Migration 0089: Extend work_requests varchar enum documentation
-- work_requests.source and work_requests.status are varchar columns (not pgEnum),
-- so no DDL change is required. This migration documents the new accepted values
-- and adds a check constraint to enforce them at the DB level going forward.

-- Extend source to include 'direct_connect'
ALTER TABLE work_requests
  DROP CONSTRAINT IF EXISTS work_requests_source_check;

ALTER TABLE work_requests
  ADD CONSTRAINT work_requests_source_check
    CHECK (source IN ('tasks', 'community', 'scout', 'direct_connect'));

-- Extend status to include 'pending_outcome'
ALTER TABLE work_requests
  DROP CONSTRAINT IF EXISTS work_requests_status_check;

ALTER TABLE work_requests
  ADD CONSTRAINT work_requests_status_check
    CHECK (status IN ('draft', 'open', 'routed', 'in_progress', 'pending_outcome', 'completed', 'cancelled'));
