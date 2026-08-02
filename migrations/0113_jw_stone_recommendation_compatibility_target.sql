-- JW Stone is an authoritative TradeScout business/supplier, not a contractor.
-- The moderated recommendation ledger still requires a legacy contractor_id,
-- so create one inactive, unverified compatibility target only when the exact
-- published profile, active business, and shared owner all match the confirmed
-- production identities. Any missing, duplicate, or conflicting binding is a
-- no-op. The adapter is business-bound and deliberately has no contractor user
-- identity; it grants no directory, routing, trust, CVS, or contact status.
WITH canonical_jw_stone AS (
  SELECT
    p.owner_user_id,
    p.business_id,
    p.slug,
    b.name AS company_name
  FROM profiles p
  INNER JOIN businesses b
    ON b.id = p.business_id
   AND b.owner_user_id = p.owner_user_id
  WHERE p.id = '8802a941-f082-45c6-b0d3-da6c484d79da'
    AND p.slug = 'jw-stone'
    AND p.status = 'published'
    AND p.owner_user_id = 'd61a5be3-d0ba-402b-afe3-47f994787c00'
    AND p.business_id = '3cbfd44b-59c5-4d08-8106-1a58b7746966'
    AND b.id = '3cbfd44b-59c5-4d08-8106-1a58b7746966'
    AND b.slug = 'jw-stone'
    AND b.status = 'active'
)
INSERT INTO contractors (
  business_id,
  company_name,
  slug,
  verified_licensed,
  verified_insured,
  is_active,
  created_at,
  updated_at
)
SELECT
  jw.business_id,
  jw.company_name,
  jw.slug,
  FALSE,
  FALSE,
  FALSE,
  now(),
  now()
FROM canonical_jw_stone jw
WHERE (SELECT count(*) FROM canonical_jw_stone) = 1
  AND NOT EXISTS (
    SELECT 1
    FROM contractors c
    WHERE c.slug = jw.slug
       OR c.business_id = jw.business_id
  )
ON CONFLICT (slug) DO NOTHING;
