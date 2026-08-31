-- Converge the persisted JW Stone presentation with the canonical Release 7
-- Full Inventory surface introduced by the compact marketplace. This changes
-- presentation wording only; material facts, seller-confirmed stock, and
-- publication authority remain separate.
WITH rewritten AS (
  SELECT
    profile.id,
    jsonb_agg(
      CASE
        WHEN block ->> 'type' = 'profilePresentation' THEN
          block || jsonb_build_object(
            'data',
            (CASE WHEN jsonb_typeof(block -> 'data') = 'object' THEN block -> 'data' ELSE '{}'::jsonb END)
            || jsonb_build_object(
              'hero',
              (CASE WHEN jsonb_typeof(block -> 'data' -> 'hero') = 'object' THEN block -> 'data' -> 'hero' ELSE '{}'::jsonb END)
              || jsonb_build_object('eyebrow', 'Amazonic Green · full inventory'),
              'copy',
              (CASE WHEN jsonb_typeof(block -> 'data' -> 'copy') = 'object' THEN block -> 'data' -> 'copy' ELSE '{}'::jsonb END)
              || jsonb_build_object('inventoryTitle', 'Browse Full Inventory'),
              'inventory',
              (CASE WHEN jsonb_typeof(block -> 'data' -> 'inventory') = 'object' THEN block -> 'data' -> 'inventory' ELSE '{}'::jsonb END)
              || jsonb_build_object('browseCtaEyebrow', 'White Rhino · full inventory')
            )
          )
        ELSE block
      END
      ORDER BY ordinal
    ) AS content_blocks
  FROM profiles AS profile
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(profile.content_blocks, '[]'::jsonb))
    WITH ORDINALITY AS entry(block, ordinal)
  WHERE profile.slug = 'jw-stone'
    AND jsonb_typeof(COALESCE(profile.content_blocks, '[]'::jsonb)) = 'array'
  GROUP BY profile.id
)
UPDATE profiles AS profile
SET content_blocks = rewritten.content_blocks,
    updated_at = NOW()
FROM rewritten
WHERE profile.id = rewritten.id
  AND profile.content_blocks IS DISTINCT FROM rewritten.content_blocks;
