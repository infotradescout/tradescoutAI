-- Migration 0090: Add response_summary jsonb column to work_request_assignments
-- Stores the structured accept response (availabilityWindow, priceBand, scopeNote)
-- at accept time so the requester can see provider responses without opening the conversation.

ALTER TABLE work_request_assignments
  ADD COLUMN IF NOT EXISTS response_summary jsonb;
