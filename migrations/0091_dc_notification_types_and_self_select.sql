-- Migration 0091: Add Direct Connect notification types and provider_self_selected event type
-- The notifications.type column is varchar (not a pgEnum in the DB), so no DDL change is needed
-- for notification types. This migration documents the new values and extends the
-- work_request_events type check constraint to include provider_self_selected.

-- Extend work_request_events type to include provider_self_selected
ALTER TABLE work_request_events
  DROP CONSTRAINT IF EXISTS work_request_events_type_check;

ALTER TABLE work_request_events
  ADD CONSTRAINT work_request_events_type_check
    CHECK (type IN (
      'created',
      'updated',
      'sent_to_board',
      'routed',
      'status_changed',
      'exposure_mode_changed',
      'provider_suggested',
      'provider_invited',
      'provider_self_selected',
      'provider_accepted',
      'provider_declined',
      'provider_completed',
      'completed',
      'cancelled'
    ));

-- Document new notification types (varchar column, no DDL needed):
-- dc_provider_accepted  - requester notified when a provider accepts their request
-- dc_provider_declined  - requester notified when a provider declines their request
-- dc_provider_interested - requester notified when a provider self-selects from the board
-- dc_request_completed  - provider notified when the requester marks the job complete
