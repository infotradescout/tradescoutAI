-- Participant invite flow for Property Lifecycle OS "build" mode.
-- Lets an owner/primary invite a contractor/realtor by email before they have a
-- TradeScout account; on accept, a property_participants row is created.

CREATE TABLE IF NOT EXISTS property_participant_invites (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_program_id VARCHAR NOT NULL REFERENCES property_programs(id) ON DELETE CASCADE,
  inviter_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email VARCHAR NOT NULL,
  participant_role VARCHAR NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  invitation_code VARCHAR NOT NULL UNIQUE,
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  accepted_participant_id VARCHAR REFERENCES property_participants(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_participant_invites_property
  ON property_participant_invites(property_program_id);
CREATE INDEX IF NOT EXISTS idx_property_participant_invites_code
  ON property_participant_invites(invitation_code);
CREATE INDEX IF NOT EXISTS idx_property_participant_invites_email
  ON property_participant_invites(invitee_email);
