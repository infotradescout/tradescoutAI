-- Add owner control and business-owned request handling without changing any records.
ALTER TABLE managed_partner_intakes
  DROP CONSTRAINT managed_partner_intakes_control_mode_check;

ALTER TABLE managed_partner_intakes
  ADD CONSTRAINT managed_partner_intakes_control_mode_check CHECK (
    control_mode IN (
      'tradescout_admin_controlled',
      'admin_stewarded_pending_owner_transfer',
      'admin_stewarded_pending_claim',
      'owner_controlled_tradescout_managed_contact',
      'owner_controlled'
    )
  );

COMMENT ON CONSTRAINT managed_partner_intakes_control_mode_check
  ON managed_partner_intakes IS 'tradescout-schema:0130:v1';

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
  ON managed_partner_intakes IS 'tradescout-schema:0130:v1';
