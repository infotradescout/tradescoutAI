-- 0071_super_admin_is_highest.sql
--
-- Product model: `super_admin` is the highest admin role.
-- `head_admin` remains in the Postgres enum for historical compatibility,
-- but should not be assigned. This migration remaps existing users.

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

