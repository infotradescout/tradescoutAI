-- Allow admin-imported directory businesses to exist unclaimed (no owner yet).
ALTER TABLE businesses
  ALTER COLUMN owner_user_id DROP NOT NULL;

