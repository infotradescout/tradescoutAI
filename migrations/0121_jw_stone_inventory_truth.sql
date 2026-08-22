-- Converge JW Stone public presentation around three separate truths:
-- the photo-backed Material Library, seller-confirmed physical stock, and
-- explicit buyer publication. Existing catalog blocks and unrelated profile
-- content are preserved verbatim.
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
              || jsonb_build_object('eyebrow', 'Amazonic Green · material library'),
              'copy',
              (CASE WHEN jsonb_typeof(block -> 'data' -> 'copy') = 'object' THEN block -> 'data' -> 'copy' ELSE '{}'::jsonb END)
              || jsonb_build_object('inventoryTitle', 'Material Library'),
              'inventory',
              (CASE WHEN jsonb_typeof(block -> 'data' -> 'inventory') = 'object' THEN block -> 'data' -> 'inventory' ELSE '{}'::jsonb END)
              || jsonb_build_object('browseCtaEyebrow', 'White Rhino · material library'),
              'audience',
              (CASE WHEN jsonb_typeof(block -> 'data' -> 'audience') = 'object' THEN block -> 'data' -> 'audience' ELSE '{}'::jsonb END)
              - 'availabilityNote',
              'social',
              (CASE WHEN jsonb_typeof(block -> 'data' -> 'social') = 'object' THEN block -> 'data' -> 'social' ELSE '{}'::jsonb END)
              || jsonb_build_object(
                'profileCta', 'Explore materials',
                'inventoryCta', 'View material photos'
              )
            )
          )
        WHEN block ->> 'type' = 'publicDiscovery' THEN
          block || jsonb_build_object(
            'data',
            (CASE WHEN jsonb_typeof(block -> 'data') = 'object' THEN block -> 'data' ELSE '{}'::jsonb END)
            || jsonb_build_object(
              'categories',
              '[
                {"sourceSlug":"granite","publicSlug":"granite","title":"Granite","summary":"Explore JW Stone''s Granite material library, compare named selections and photographs, and start a material request when ready.","leadItemSlug":"arizona-gold","indexable":true,"collectionKind":"offerings"},
                {"sourceSlug":"marble","publicSlug":"marble","title":"Marble","summary":"Explore JW Stone''s Marble material library, compare named selections and photographs, and start a material request when ready.","leadItemSlug":"alabama-rose","indexable":true,"collectionKind":"offerings"},
                {"sourceSlug":"quartzite","publicSlug":"quartzite","title":"Quartzite","summary":"Explore JW Stone''s Quartzite material library, compare named selections and photographs, and start a material request when ready.","leadItemSlug":"atlantic","indexable":true,"collectionKind":"offerings"},
                {"sourceSlug":"quartz","publicSlug":"engineered-quartz","title":"Engineered Quartz","summary":"Explore JW Stone''s Engineered Quartz material library, compare named selections and photographs, and start a material request when ready.","leadItemSlug":"aj-quartz","indexable":true,"collectionKind":"offerings"},
                {"sourceSlug":"onyx","publicSlug":"onyx","title":"Onyx","summary":"Explore JW Stone''s Onyx material library, review the exact material photographs, and start a material request when ready.","leadItemSlug":"honey-onyx","indexable":true,"collectionKind":"offerings"},
                {"sourceSlug":"soapstone","publicSlug":"soapstone","title":"Soapstone","summary":"Explore JW Stone''s Soapstone material library, review the exact material photographs, and start a material request when ready.","leadItemSlug":"marina-black-soapstone","indexable":true,"collectionKind":"offerings"},
                {"sourceSlug":"basalt","publicSlug":"basalt","title":"Basalt","summary":"Explore JW Stone''s Basalt material library, review the exact material photographs, and start a material request when ready.","leadItemSlug":"matrix-basalt","indexable":true,"collectionKind":"offerings"}
              ]'::jsonb
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
