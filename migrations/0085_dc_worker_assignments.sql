-- Migration 0085: Add worker_id to work_request_assignments
-- Allows helpers (workers table) to be first-class DC responders alongside
-- contractors (contractorId) and businesses (responderUserId).
ALTER TABLE work_request_assignments
  ADD COLUMN IF NOT EXISTS worker_id VARCHAR REFERENCES workers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wra_worker_id_idx ON work_request_assignments(worker_id);
