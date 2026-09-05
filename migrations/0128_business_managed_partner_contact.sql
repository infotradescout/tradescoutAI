-- Add business-owned request handling without changing any intake or business record.
ALTER TABLE managed_partner_intakes
  DROP CONSTRAINT managed_partner_intakes_contact_mode_check;

ALTER TABLE managed_partner_intakes
  ADD CONSTRAINT managed_partner_intakes_contact_mode_check CHECK (
    contact_mode IN (
      'tradescout_managed',
      'business_phone_tradescout_email',
      'business_managed',
      'pending_owner_contact'
    )
  );

COMMENT ON CONSTRAINT managed_partner_intakes_contact_mode_check
  ON managed_partner_intakes IS 'tradescout-schema:0128:v1';
