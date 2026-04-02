-- Allow pure messaging conversations without requiring a marketplace listing
ALTER TABLE marketplace_conversations
  ALTER COLUMN listing_id DROP NOT NULL;
