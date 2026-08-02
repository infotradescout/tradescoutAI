-- Transaction-safe compatibility marker.
--
-- Migration 0019 already creates the single-column indexes used by current
-- Mission Control queries. Historical databases may also contain the old
-- compound indexes; they remain valid and are intentionally left in place.
-- Fresh databases do not need those unused compound indexes. In particular,
-- concurrent index creation cannot run inside Drizzle's migration transaction.
DO $$
BEGIN
  RAISE NOTICE 'Mission Control compound-index compatibility marker applied';
END
$$;
