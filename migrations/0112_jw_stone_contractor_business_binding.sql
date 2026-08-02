-- Restore JW Stone's exact provider binding so moderated recommendations can
-- target the linked business. Fail closed unless there is exactly one
-- published profile/business owner match and exactly one unbound contractor.
WITH jw_profile AS (
  SELECT owner_user_id, business_id
  FROM profiles
  WHERE slug = 'jw-stone'
    AND status = 'published'
    AND business_id IS NOT NULL
),
eligible_binding AS (
  SELECT p.owner_user_id, p.business_id, min(c.id) AS contractor_id
  FROM jw_profile p
  JOIN contractors c
    ON c.user_id = p.owner_user_id
   AND c.business_id IS NULL
  GROUP BY p.owner_user_id, p.business_id
  HAVING count(*) = 1
     AND (SELECT count(*) FROM jw_profile) = 1
)
UPDATE contractors c
SET business_id = binding.business_id,
    updated_at = now()
FROM eligible_binding binding
WHERE c.id = binding.contractor_id
  AND c.user_id = binding.owner_user_id
  AND c.business_id IS NULL;
