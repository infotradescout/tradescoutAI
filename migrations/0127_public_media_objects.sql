-- Existing production PostgreSQL is the fail-closed public-media owner when
-- neither of the service's S3-compatible contracts is configured. The table is
-- isolated to public object keys; private application files cannot be inserted.
CREATE TABLE IF NOT EXISTS public_media_objects (
  object_key TEXT PRIMARY KEY,
  body BYTEA NOT NULL,
  content_length BIGINT GENERATED ALWAYS AS (octet_length(body)) STORED,
  content_type TEXT NOT NULL,
  etag TEXT NOT NULL,
  cache_control TEXT NOT NULL DEFAULT 'public, max-age=31536000, immutable',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT public_media_objects_key_check CHECK (
    object_key ~ '^(public-media|uploads)/[A-Za-z0-9._/-]+$'
    AND position('..' IN object_key) = 0
    AND position(chr(92) IN object_key) = 0
  ),
  CONSTRAINT public_media_objects_length_check CHECK (
    octet_length(body) > 0 AND octet_length(body) <= 26214400
  ),
  CONSTRAINT public_media_objects_type_check CHECK (
    content_type ~ '^(image|video)/[a-z0-9.+-]+$'
    OR content_type = 'application/json'
  ),
  CONSTRAINT public_media_objects_etag_check CHECK (
    etag ~ '^"[a-f0-9]{64}"$'
  ),
  CONSTRAINT public_media_objects_metadata_check CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

COMMENT ON TABLE public_media_objects IS
  'TradeScout immutable public-media object fallback; tradescout-schema:0127:v1';
COMMENT ON CONSTRAINT public_media_objects_key_check ON public_media_objects IS
  'tradescout-schema:0127:v1';
COMMENT ON CONSTRAINT public_media_objects_length_check ON public_media_objects IS
  'tradescout-schema:0127:v1';
COMMENT ON CONSTRAINT public_media_objects_type_check ON public_media_objects IS
  'tradescout-schema:0127:v1';
COMMENT ON CONSTRAINT public_media_objects_etag_check ON public_media_objects IS
  'tradescout-schema:0127:v1';
COMMENT ON CONSTRAINT public_media_objects_metadata_check ON public_media_objects IS
  'tradescout-schema:0127:v1';
