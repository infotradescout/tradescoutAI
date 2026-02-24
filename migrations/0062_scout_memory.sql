-- Scout Memory System - Persistent Conversation & Learning Storage
-- Enables Scout to remember tool results, user preferences, conversation context,
-- learning points, and proactive suggestions across sessions.

CREATE TABLE IF NOT EXISTS scout_memory (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar NOT NULL CHECK (type IN ('tool_result', 'user_preference', 'conversation_context', 'learning_point', 'proactive_suggestion')),
  key varchar NOT NULL,
  value jsonb NOT NULL,
  metadata jsonb DEFAULT '{}',
  ttl_seconds integer,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp GENERATED ALWAYS AS (created_at + (ttl_seconds || ' seconds')::interval) STORED,
  UNIQUE(user_id, type, key)
);

-- Indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_scout_memory_user ON scout_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_scout_memory_type ON scout_memory(type);
CREATE INDEX IF NOT EXISTS idx_scout_memory_key ON scout_memory(key);
CREATE INDEX IF NOT EXISTS idx_scout_memory_user_type ON scout_memory(user_id, type);
CREATE INDEX IF NOT EXISTS idx_scout_memory_expires_at ON scout_memory(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_memory_created_at ON scout_memory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scout_memory_metadata ON scout_memory USING gin(metadata);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION scout_memory_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scout_memory_update_timestamp_trigger
  BEFORE UPDATE ON scout_memory
  FOR EACH ROW
  EXECUTE FUNCTION scout_memory_update_timestamp();
