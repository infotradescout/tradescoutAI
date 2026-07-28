-- Keep every JW Stone inventory and category URL on the verified JW domain.
-- Route names and category presentation are profile-owned data; shared
-- routing and indexing code do not branch on the profile slug or template.
--
-- This migration deliberately converges duplicate, partial, stale, or empty
-- discovery blocks into one canonical block while preserving unrelated
-- profile blocks and unrelated keys on the first discovery block.
WITH defaults AS (
  SELECT '[
    {
      "sourceSlug": "granite",
      "publicSlug": "granite",
      "title": "Granite",
      "summary": "Explore JW Stone''s current Granite inventory, compare named slabs and photographs, and request current pricing or availability for a selected material.",
      "leadItemSlug": "arizona-gold",
      "indexable": true
    },
    {
      "sourceSlug": "marble",
      "publicSlug": "marble",
      "title": "Marble",
      "summary": "Explore JW Stone''s current Marble inventory, compare named slabs and photographs, and request current pricing or availability for a selected material.",
      "leadItemSlug": "alabama-rose",
      "indexable": true
    },
    {
      "sourceSlug": "quartzite",
      "publicSlug": "quartzite",
      "title": "Quartzite",
      "summary": "Explore JW Stone''s current Quartzite inventory, compare named slabs and photographs, and request current pricing or availability for a selected material.",
      "leadItemSlug": "atlantic",
      "indexable": true
    },
    {
      "sourceSlug": "quartz",
      "publicSlug": "engineered-quartz",
      "title": "Engineered Quartz",
      "summary": "Explore JW Stone''s current Engineered Quartz inventory, compare named selections and photographs, and request current pricing or availability for a selected material.",
      "leadItemSlug": "aj-quartz",
      "indexable": true
    },
    {
      "sourceSlug": "onyx",
      "publicSlug": "onyx",
      "title": "Onyx",
      "summary": "Explore the Onyx currently published in JW Stone''s inventory, review the exact material photographs, and request current pricing or availability.",
      "leadItemSlug": "honey-onyx",
      "indexable": true
    },
    {
      "sourceSlug": "soapstone",
      "publicSlug": "soapstone",
      "title": "Soapstone",
      "summary": "Explore the Soapstone currently published in JW Stone''s inventory, review the exact material photographs, and request current pricing or availability.",
      "leadItemSlug": "soapstone",
      "indexable": true
    },
    {
      "sourceSlug": "basalt",
      "publicSlug": "basalt",
      "title": "Basalt",
      "summary": "Explore the Basalt currently published in JW Stone''s inventory, review the exact material photographs, and request current pricing or availability.",
      "leadItemSlug": "matrix-basalt",
      "indexable": true
    }
  ]'::jsonb AS categories
),
target AS (
  SELECT
    profile.id,
    COALESCE(profile.content_blocks, '[]'::jsonb) AS content_blocks,
    COALESCE(
      (
        SELECT block
        FROM jsonb_array_elements(COALESCE(profile.content_blocks, '[]'::jsonb))
          WITH ORDINALITY AS existing(block, ordinal)
        WHERE block ->> 'type' = 'publicDiscovery'
        ORDER BY ordinal
        LIMIT 1
      ),
      jsonb_build_object('type', 'publicDiscovery', 'data', '{}'::jsonb)
    ) AS first_discovery_block,
    COALESCE(
      (
        SELECT MIN(ordinal)
        FROM jsonb_array_elements(COALESCE(profile.content_blocks, '[]'::jsonb))
          WITH ORDINALITY AS existing(block, ordinal)
        WHERE block ->> 'type' = 'publicDiscovery'
      ),
      jsonb_array_length(COALESCE(profile.content_blocks, '[]'::jsonb)) + 1
    )::bigint AS discovery_ordinal
  FROM profiles AS profile
  WHERE profile.slug = 'jw-stone'
    AND jsonb_typeof(COALESCE(profile.content_blocks, '[]'::jsonb)) = 'array'
),
merged AS (
  SELECT
    target.id,
    target.content_blocks,
    target.discovery_ordinal,
    target.first_discovery_block || jsonb_build_object(
      'type', 'publicDiscovery',
      'data',
      (
        CASE
          WHEN jsonb_typeof(target.first_discovery_block -> 'data') = 'object'
            THEN target.first_discovery_block -> 'data'
          ELSE '{}'::jsonb
        END
      ) || jsonb_build_object(
        'routes',
        (
          CASE
            WHEN jsonb_typeof(target.first_discovery_block -> 'data' -> 'routes') = 'object'
              THEN target.first_discovery_block -> 'data' -> 'routes'
            ELSE '{}'::jsonb
          END
        ) || jsonb_build_object(
          'inventory', 'stones',
          'categories', 'materials'
        ),
        'categories', defaults.categories
      )
    ) AS discovery_block
  FROM target
  CROSS JOIN defaults
),
rebuilt AS (
  SELECT
    merged.id,
    merged.content_blocks,
    (
      SELECT COALESCE(jsonb_agg(entry.block ORDER BY entry.sort_key), '[]'::jsonb)
      FROM (
        SELECT existing.block, existing.ordinal::bigint * 2 AS sort_key
        FROM jsonb_array_elements(merged.content_blocks)
          WITH ORDINALITY AS existing(block, ordinal)
        WHERE existing.block ->> 'type' IS DISTINCT FROM 'publicDiscovery'

        UNION ALL

        SELECT merged.discovery_block, merged.discovery_ordinal * 2 AS sort_key
      ) AS entry
    ) AS next_content_blocks
  FROM merged
)
UPDATE profiles AS profile
SET
  content_blocks = rebuilt.next_content_blocks,
  updated_at = NOW()
FROM rebuilt
WHERE profile.id = rebuilt.id
  AND rebuilt.content_blocks IS DISTINCT FROM rebuilt.next_content_blocks;
