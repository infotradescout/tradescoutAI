-- Scout Memory System - Persistent Conversation & Learning Storage
-- Enables Scout to remember tool results, user preferences, conversation context,
-- learning points, and proactive suggestions across sessions.

DO $$
BEGIN
  CREATE TYPE scout_memory_type AS ENUM (
    'tool_result',
    'user_preference',
    'conversation_context',
    'learning_point',
    'proactive_suggestion'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS scout_memory (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type scout_memory_type NOT NULL,
  key varchar NOT NULL,
  value jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ttl_seconds integer,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS scout_memory_user_idx ON scout_memory(user_id);
CREATE INDEX IF NOT EXISTS scout_memory_type_idx ON scout_memory(type);
CREATE INDEX IF NOT EXISTS scout_memory_key_idx ON scout_memory(key);
CREATE INDEX IF NOT EXISTS scout_memory_user_type_idx ON scout_memory(user_id, type);
CREATE INDEX IF NOT EXISTS scout_memory_created_idx ON scout_memory(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS scout_memory_user_type_key_unique
  ON scout_memory(user_id, type, key);
