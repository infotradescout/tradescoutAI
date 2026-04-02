-- Mission Control optional hardening: compound indexes for impact sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_ui_findings_route_created_at
  ON bot_ui_findings (route, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scout_interactions_intent_created_at
  ON scout_interactions (intent, created_at DESC);
