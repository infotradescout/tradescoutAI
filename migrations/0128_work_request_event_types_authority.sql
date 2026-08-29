-- Lane migration: final integration reserves HomeID as migration 0133.
-- Keep historical migration 0091 immutable; widen the active constraint only
-- through this forward migration.
ALTER TABLE IF EXISTS work_request_events
  DROP CONSTRAINT IF EXISTS work_request_events_type_check;

ALTER TABLE IF EXISTS work_request_events
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
      'cancelled',
      'asset_linked',
      'homeid_draft_created',
      'homeid_draft_reviewed',
      'homeid_draft_submitted'
    ));
