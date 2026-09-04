-- Professional applications are one-per-user trust records. Refuse to guess which
-- legacy duplicate is canonical; operators must reconcile duplicates before retrying.
DO $$
DECLARE
  realtor_duplicate_groups bigint;
  car_salesman_duplicate_groups bigint;
BEGIN
  SELECT count(*)
    INTO realtor_duplicate_groups
    FROM (
      SELECT user_id
      FROM realtor_profiles
      GROUP BY user_id
      HAVING count(*) > 1
    ) duplicates;

  SELECT count(*)
    INTO car_salesman_duplicate_groups
    FROM (
      SELECT user_id
      FROM car_salesman_profiles
      GROUP BY user_id
      HAVING count(*) > 1
    ) duplicates;

  IF realtor_duplicate_groups > 0 OR car_salesman_duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'professional application integrity preflight failed: realtor duplicate groups=%, car salesman duplicate groups=%; reconcile legacy rows before rerunning migration 0129',
      realtor_duplicate_groups,
      car_salesman_duplicate_groups
      USING ERRCODE = '23505',
            HINT = 'Do not delete rows automatically. Select the canonical row per user and archive or export the others under an operator-reviewed remediation.';
  END IF;
END $$;

ALTER TABLE realtor_profiles
  ADD COLUMN IF NOT EXISTS reviewed_by varchar,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp,
  ADD COLUMN IF NOT EXISTS review_notes text;

ALTER TABLE car_salesman_profiles
  ADD COLUMN IF NOT EXISTS reviewed_by varchar,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp,
  ADD COLUMN IF NOT EXISTS review_notes text;

ALTER TABLE realtor_profiles
  DROP CONSTRAINT IF EXISTS realtor_profiles_reviewed_by_fk;
ALTER TABLE realtor_profiles
  ADD CONSTRAINT realtor_profiles_reviewed_by_fk
  FOREIGN KEY (reviewed_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

ALTER TABLE car_salesman_profiles
  DROP CONSTRAINT IF EXISTS car_salesman_profiles_reviewed_by_fk;
ALTER TABLE car_salesman_profiles
  ADD CONSTRAINT car_salesman_profiles_reviewed_by_fk
  FOREIGN KEY (reviewed_by)
  REFERENCES users(id)
  ON DELETE SET NULL;

ALTER TABLE realtor_profiles
  DROP CONSTRAINT IF EXISTS realtor_profiles_review_notes_length_check;
ALTER TABLE realtor_profiles
  ADD CONSTRAINT realtor_profiles_review_notes_length_check
  CHECK (review_notes IS NULL OR char_length(review_notes) <= 4000);

ALTER TABLE car_salesman_profiles
  DROP CONSTRAINT IF EXISTS car_salesman_profiles_review_notes_length_check;
ALTER TABLE car_salesman_profiles
  ADD CONSTRAINT car_salesman_profiles_review_notes_length_check
  CHECK (review_notes IS NULL OR char_length(review_notes) <= 4000);

COMMENT ON CONSTRAINT realtor_profiles_reviewed_by_fk ON realtor_profiles IS 'tradescout-schema:0129:v2';
COMMENT ON CONSTRAINT realtor_profiles_review_notes_length_check ON realtor_profiles IS 'tradescout-schema:0129:v2';
COMMENT ON CONSTRAINT car_salesman_profiles_reviewed_by_fk ON car_salesman_profiles IS 'tradescout-schema:0129:v2';
COMMENT ON CONSTRAINT car_salesman_profiles_review_notes_length_check ON car_salesman_profiles IS 'tradescout-schema:0129:v2';

UPDATE realtor_profiles
SET verification_status = 'pending'
WHERE verification_status IS NULL OR verification_status = 'under_review';

UPDATE car_salesman_profiles
SET verification_status = 'pending'
WHERE verification_status IS NULL OR verification_status = 'under_review';

UPDATE realtor_profiles
SET is_active = false
WHERE is_active IS NULL OR verification_status <> 'approved';

UPDATE car_salesman_profiles
SET is_active = false
WHERE is_active IS NULL OR verification_status <> 'approved';

-- Legacy application submission granted professional roles before review. Rebuild
-- professional authority from approved, active profile records while retaining all
-- unrelated roles and authority backed by an approved sibling professional profile.
WITH approved_professional_authority AS (
  SELECT
    users.id AS user_id,
    EXISTS (
      SELECT 1
      FROM realtor_profiles
      WHERE realtor_profiles.user_id = users.id
        AND realtor_profiles.verification_status = 'approved'
        AND realtor_profiles.is_active IS TRUE
    ) AS realtor_approved,
    EXISTS (
      SELECT 1
      FROM car_salesman_profiles
      WHERE car_salesman_profiles.user_id = users.id
        AND car_salesman_profiles.verification_status = 'approved'
        AND car_salesman_profiles.is_active IS TRUE
    ) AS car_dealer_approved
  FROM users
), primary_role_reconciliation AS (
  SELECT
    users.id AS user_id,
    authority.realtor_approved,
    authority.car_dealer_approved,
    CASE
      WHEN users.role IS NULL THEN
        CASE
          WHEN regexp_replace(lower(btrim(coalesce(users.active_role, ''))), '[[:space:]-]+', '_', 'g') = 'realtor'
            AND authority.realtor_approved THEN 'realtor'::user_role
          WHEN regexp_replace(lower(btrim(coalesce(users.active_role, ''))), '[[:space:]-]+', '_', 'g') IN (
            'car_dealer',
            'car_salesman',
            'vehicle_dealer'
          ) AND authority.car_dealer_approved THEN 'car_dealer'::user_role
          WHEN authority.realtor_approved THEN 'realtor'::user_role
          WHEN authority.car_dealer_approved THEN 'car_dealer'::user_role
          ELSE 'homeowner'::user_role
        END
      WHEN users.role::text = 'realtor' AND NOT authority.realtor_approved THEN
        CASE
          WHEN authority.car_dealer_approved THEN 'car_dealer'::user_role
          ELSE 'homeowner'::user_role
        END
      WHEN users.role::text = 'car_dealer' AND NOT authority.car_dealer_approved THEN
        CASE
          WHEN authority.realtor_approved THEN 'realtor'::user_role
          ELSE 'homeowner'::user_role
        END
      ELSE users.role
    END AS next_role
  FROM users
  INNER JOIN approved_professional_authority authority
    ON authority.user_id = users.id
), identity_reconciliation AS (
  SELECT
    users.id AS user_id,
    primary_roles.next_role,
    CASE
      WHEN regexp_replace(lower(btrim(coalesce(users.active_role, ''))), '[[:space:]-]+', '_', 'g') = 'realtor' THEN
        CASE
          WHEN primary_roles.realtor_approved THEN 'realtor'
          ELSE primary_roles.next_role::text
        END
      WHEN regexp_replace(lower(btrim(coalesce(users.active_role, ''))), '[[:space:]-]+', '_', 'g') IN (
        'car_dealer',
        'car_salesman',
        'vehicle_dealer'
      ) THEN
        CASE
          WHEN primary_roles.car_dealer_approved THEN 'car_dealer'
          ELSE primary_roles.next_role::text
        END
      WHEN btrim(coalesce(users.active_role, '')) = '' THEN primary_roles.next_role::text
      ELSE btrim(users.active_role)
    END AS next_active_role
  FROM users
  INNER JOIN primary_role_reconciliation primary_roles
    ON primary_roles.user_id = users.id
)
UPDATE users
SET
  role = reconciled.next_role,
  active_role = reconciled.next_active_role,
  updated_at = now()
FROM identity_reconciliation reconciled
WHERE users.id = reconciled.user_id
  AND (
    users.role IS DISTINCT FROM reconciled.next_role
    OR users.active_role IS DISTINCT FROM reconciled.next_active_role
  );

WITH approved_professional_authority AS (
  SELECT
    users.id AS user_id,
    EXISTS (
      SELECT 1
      FROM realtor_profiles
      WHERE realtor_profiles.user_id = users.id
        AND realtor_profiles.verification_status = 'approved'
        AND realtor_profiles.is_active IS TRUE
    ) AS realtor_approved,
    EXISTS (
      SELECT 1
      FROM car_salesman_profiles
      WHERE car_salesman_profiles.user_id = users.id
        AND car_salesman_profiles.verification_status = 'approved'
        AND car_salesman_profiles.is_active IS TRUE
    ) AS car_dealer_approved
  FROM users
), rebuilt_role_sets AS (
  SELECT
    users.id AS user_id,
    coalesce(
      (
        SELECT array_agg(ordered_roles.canonical_role ORDER BY ordered_roles.first_ordinality)
        FROM (
          SELECT
            canonical.canonical_role,
            min(raw_role.ordinality) AS first_ordinality
          FROM unnest(
            coalesce(users.roles, ARRAY[]::text[])
            || CASE
              WHEN authority.realtor_approved THEN ARRAY['realtor']::text[]
              ELSE ARRAY[]::text[]
            END
            || CASE
              WHEN authority.car_dealer_approved THEN ARRAY['car_dealer']::text[]
              ELSE ARRAY[]::text[]
            END
          ) WITH ORDINALITY AS raw_role(role_value, ordinality)
          CROSS JOIN LATERAL (
            SELECT regexp_replace(
              lower(btrim(raw_role.role_value)),
              '[[:space:]-]+',
              '_',
              'g'
            ) AS normalized_role
          ) normalized
          CROSS JOIN LATERAL (
            SELECT CASE
              WHEN normalized.normalized_role = 'realtor' THEN
                CASE WHEN authority.realtor_approved THEN 'realtor' END
              WHEN normalized.normalized_role IN (
                'car_dealer',
                'car_salesman',
                'vehicle_dealer'
              ) THEN
                CASE WHEN authority.car_dealer_approved THEN 'car_dealer' END
              ELSE nullif(btrim(raw_role.role_value), '')
            END AS canonical_role
          ) canonical
          WHERE canonical.canonical_role IS NOT NULL
          GROUP BY canonical.canonical_role
        ) ordered_roles
      ),
      ARRAY[]::text[]
    ) AS next_roles
  FROM users
  INNER JOIN approved_professional_authority authority
    ON authority.user_id = users.id
  WHERE authority.realtor_approved
    OR authority.car_dealer_approved
    OR EXISTS (
      SELECT 1
      FROM unnest(coalesce(users.roles, ARRAY[]::text[])) AS existing_role(role_value)
      WHERE regexp_replace(
        lower(btrim(existing_role.role_value)),
        '[[:space:]-]+',
        '_',
        'g'
      ) IN ('realtor', 'car_dealer', 'car_salesman', 'vehicle_dealer')
    )
)
UPDATE users
SET
  roles = rebuilt.next_roles,
  updated_at = now()
FROM rebuilt_role_sets rebuilt
WHERE users.id = rebuilt.user_id
  AND users.roles IS DISTINCT FROM rebuilt.next_roles;

ALTER TABLE realtor_profiles
  ALTER COLUMN verification_status SET DEFAULT 'pending',
  ALTER COLUMN verification_status SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT false,
  ALTER COLUMN is_active SET NOT NULL;

ALTER TABLE car_salesman_profiles
  ALTER COLUMN verification_status SET DEFAULT 'pending',
  ALTER COLUMN verification_status SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT false,
  ALTER COLUMN is_active SET NOT NULL;

DROP INDEX IF EXISTS uq_realtor_profiles_user_id;
CREATE UNIQUE INDEX uq_realtor_profiles_user_id
  ON realtor_profiles(user_id);

DROP INDEX IF EXISTS uq_car_salesman_profiles_user_id;
CREATE UNIQUE INDEX uq_car_salesman_profiles_user_id
  ON car_salesman_profiles(user_id);

COMMENT ON COLUMN realtor_profiles.reviewed_by IS 'Admin user that made the durable professional application decision; tradescout-schema:0129:v2';
COMMENT ON COLUMN realtor_profiles.reviewed_at IS 'Durable professional application decision timestamp; tradescout-schema:0129:v2';
COMMENT ON COLUMN realtor_profiles.review_notes IS 'Durable professional application decision notes; tradescout-schema:0129:v2';
COMMENT ON INDEX uq_realtor_profiles_user_id IS 'One realtor application record per user; tradescout-schema:0129:v2';

COMMENT ON COLUMN car_salesman_profiles.reviewed_by IS 'Admin user that made the durable professional application decision; tradescout-schema:0129:v2';
COMMENT ON COLUMN car_salesman_profiles.reviewed_at IS 'Durable professional application decision timestamp; tradescout-schema:0129:v2';
COMMENT ON COLUMN car_salesman_profiles.review_notes IS 'Durable professional application decision notes; tradescout-schema:0129:v2';
COMMENT ON INDEX uq_car_salesman_profiles_user_id IS 'One car salesman application record per user; tradescout-schema:0129:v2';
