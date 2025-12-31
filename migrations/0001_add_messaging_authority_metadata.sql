-- Migration: Add Messaging Authority Contract metadata fields to marketplace_conversations
-- Phase D1: Decision Card → Contact integration
-- Date: 2025-12-30

-- Add new columns for messaging authority tracking
ALTER TABLE marketplace_conversations
ADD COLUMN IF NOT EXISTS intent VARCHAR(20) CHECK (intent IN ('hire', 'advise', 'collaborate', 'reconnect')),
ADD COLUMN IF NOT EXISTS authority_gate VARCHAR(30) CHECK (authority_gate IN ('decision_card', 'scout_recommendation', 'user_search')),
ADD COLUMN IF NOT EXISTS source_decision_card_id VARCHAR,
ADD COLUMN IF NOT EXISTS source_scout_recommendation_id VARCHAR,
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
ADD COLUMN IF NOT EXISTS decision_scope TEXT;

-- Create index on authority_gate for filtering conversations by source
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_authority_gate 
ON marketplace_conversations(authority_gate);

-- Create index on source_decision_card_id for decision outcome tracking
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_decision_card 
ON marketplace_conversations(source_decision_card_id) 
WHERE source_decision_card_id IS NOT NULL;

-- Create index on intent for conversation filtering
CREATE INDEX IF NOT EXISTS idx_marketplace_conversations_intent 
ON marketplace_conversations(intent);

-- Add comment for documentation
COMMENT ON COLUMN marketplace_conversations.intent IS 'Why contact was made (immutable after creation)';
COMMENT ON COLUMN marketplace_conversations.authority_gate IS 'How contact was authorized (decision_card, scout_recommendation, or user_search)';
COMMENT ON COLUMN marketplace_conversations.source_decision_card_id IS 'Decision Card ID if initiated from decision outcome';
COMMENT ON COLUMN marketplace_conversations.source_scout_recommendation_id IS 'Scout Recommendation ID if initiated from Scout suggestion';
COMMENT ON COLUMN marketplace_conversations.confidence_score IS 'Scout confidence score at time of contact (0.00-1.00)';
COMMENT ON COLUMN marketplace_conversations.decision_scope IS 'Decision context captured at time of contact';
