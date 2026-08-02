-- 0071_super_admin_is_highest.sql
--
-- Product model: `super_admin` is the highest admin role.
-- `head_admin` remains in the Postgres enum for historical compatibility,
-- but should not be assigned. This migration remaps existing users.

-- Multi-role fields also entered deployed databases through schema push before
-- this migration referenced them. Restore the active nullable/default contract
-- so a clean journal can perform the same normalization.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS roles text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS active_role varchar DEFAULT 'homeowner';

-- Some deployed databases received the expanded role enum through schema push,
-- while clean journal installs still have the original enum. PostgreSQL cannot
-- add and consume an enum label in the same transaction, so rebuild the type
-- only when `super_admin` is absent. The replacement includes both the active
-- role contract and every legacy label so existing rows remain representable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
      AND e.enumlabel = 'super_admin'
  ) THEN
    RETURN;
  END IF;

  ALTER TYPE public.user_role RENAME TO user_role_legacy_0071;

  CREATE TYPE public.user_role AS ENUM (
    'homeowner',
    'renter',
    'landlord',
    'property_manager',
    'hoa_member',
    'business_owner',
    'commercial_property',
    'franchise_owner',
    'startup_founder',
    'contractor',
    'handyman',
    'service_provider',
    'specialty_tradesperson',
    'designer',
    'inspector',
    'realtor',
    'mortgage_broker',
    'insurance_agent',
    'title_company',
    'car_dealer',
    'auto_service',
    'hoa_board',
    'community_builder',
    'nonprofit_org',
    'affiliate',
    'content_creator',
    'admin',
    'content_seo',
    'analytics_specialist',
    'marketing_specialist',
    'moderator',
    'ops_admin',
    'super_admin',
    'head_admin',
    'contractor_user',
    'accelerator_member',
    'car_salesman',
    'territory_manager',
    'contractor_success',
    'analytics_read',
    'support'
  );

  ALTER TABLE public.users ALTER COLUMN role DROP DEFAULT;
  ALTER TABLE public.user_profiles ALTER COLUMN role DROP DEFAULT;

  ALTER TABLE public.users
    ALTER COLUMN role TYPE public.user_role USING (role::text::public.user_role);
  ALTER TABLE public.user_profiles
    ALTER COLUMN role TYPE public.user_role USING (role::text::public.user_role);
  ALTER TABLE public.businesses
    ALTER COLUMN role_context TYPE public.user_role USING (role_context::text::public.user_role);
  ALTER TABLE public.profiles
    ALTER COLUMN role_context TYPE public.user_role USING (role_context::text::public.user_role);
  ALTER TABLE public.invitations
    ALTER COLUMN target_role TYPE public.user_role USING (target_role::text::public.user_role);

  ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'homeowner'::public.user_role;
  ALTER TABLE public.user_profiles ALTER COLUMN role SET DEFAULT 'homeowner'::public.user_role;

  DROP TYPE public.user_role_legacy_0071;
END $$;

-- Primary role
UPDATE users
SET role = 'super_admin'
WHERE role = 'head_admin';

-- Active role (dashboard switching)
UPDATE users
SET active_role = 'super_admin'
WHERE active_role = 'head_admin';

-- Multi-role array (text[])
UPDATE users
SET roles = (
  SELECT ARRAY(
    SELECT DISTINCT CASE WHEN r = 'head_admin' THEN 'super_admin' ELSE r END
    FROM unnest(COALESCE(users.roles, ARRAY[]::text[])) AS r
    WHERE r IS NOT NULL AND length(btrim(r)) > 0
  )
)
WHERE roles @> ARRAY['head_admin']::text[];
