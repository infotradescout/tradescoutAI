CREATE TABLE IF NOT EXISTS admin_live_stream_snapshots (
  id bigserial PRIMARY KEY,
  source_filter text,
  state_code varchar(2),
  county_filter text,
  limit_value integer NOT NULL DEFAULT 20,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  stream_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS idx_admin_live_stream_snapshots_unique;
CREATE UNIQUE INDEX idx_admin_live_stream_snapshots_unique
ON admin_live_stream_snapshots (
  coalesce(source_filter, ''),
  coalesce(state_code, ''),
  coalesce(county_filter, ''),
  limit_value
);
COMMENT ON INDEX idx_admin_live_stream_snapshots_unique IS 'tradescout-schema:0116:v1';

CREATE TABLE IF NOT EXISTS admin_live_stream_snapshot_history (
  id bigserial PRIMARY KEY,
  source_filter text,
  state_code varchar(2),
  county_filter text,
  limit_value integer NOT NULL DEFAULT 20,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  stream_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS idx_admin_live_stream_snapshot_history_lookup;
CREATE INDEX idx_admin_live_stream_snapshot_history_lookup
ON admin_live_stream_snapshot_history (
  coalesce(source_filter, ''),
  coalesce(state_code, ''),
  coalesce(county_filter, ''),
  computed_at DESC
);
COMMENT ON INDEX idx_admin_live_stream_snapshot_history_lookup IS 'tradescout-schema:0116:v1';
