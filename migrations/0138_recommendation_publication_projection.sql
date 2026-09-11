-- Save privately before email confirmation. Restore the recommendation columns
-- already used by the runtime on databases built only from the migration journal.
-- Legacy star ratings do not establish a positive/negative recommendation or
-- moderation approval, so no publication decision is inferred for those rows.
ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS recommendation_type varchar,
  ADD COLUMN IF NOT EXISTS project_type varchar,
  ADD COLUMN IF NOT EXISTS project_value numeric,
  ADD COLUMN IF NOT EXISTS work_quality varchar,
  ADD COLUMN IF NOT EXISTS timeliness varchar,
  ADD COLUMN IF NOT EXISTS communication varchar,
  ADD COLUMN IF NOT EXISTS would_hire_again boolean,
  ADD COLUMN IF NOT EXISTS customer_name varchar,
  ADD COLUMN IF NOT EXISTS customer_email varchar,
  ADD COLUMN IF NOT EXISTS customer_phone varchar,
  ADD COLUMN IF NOT EXISTS ip_address varchar,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS verification_method varchar,
  ADD COLUMN IF NOT EXISTS verified_at timestamp,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status varchar DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderated_at timestamp,
  ADD COLUMN IF NOT EXISTS moderated_by varchar;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='recommendations' AND column_name='rating') THEN
    ALTER TABLE recommendations ALTER COLUMN rating DROP NOT NULL;
  END IF;
END;
$$;

ALTER TABLE contractor_leaderboard_stats
  ADD COLUMN IF NOT EXISTS monthly_positive_recommendations integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_negative_recommendations integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_total_recommendations integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_positive_recommendations integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_negative_recommendations integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_total_recommendations integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_recommendation_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_recommendation_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_recommendation_percentage numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_recommendation_percentage numeric(5,2) DEFAULT 0;

-- Scores count recommendations; do not fail a verified publication at 1,000.
ALTER TABLE contractors ALTER COLUMN recommendation_score TYPE numeric;
ALTER TABLE contractor_leaderboard_stats
  ALTER COLUMN monthly_recommendation_score TYPE numeric,
  ALTER COLUMN lifetime_recommendation_score TYPE numeric;

CREATE INDEX IF NOT EXISTS recommendations_contractor_created_idx
  ON recommendations (contractor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recommendations_author_idx ON recommendations (user_id);
CREATE INDEX IF NOT EXISTS recommendations_email_window_idx
  ON recommendations (contractor_id, lower(trim(customer_email)), created_at DESC);
CREATE INDEX IF NOT EXISTS recommendations_ip_window_idx
  ON recommendations (ip_address, created_at DESC);

-- These are derived caches. Repair duplicates and replace historic increments
-- with projections of currently publishable recommendations in this transaction.
DELETE FROM contractor_leaderboard_stats a USING contractor_leaderboard_stats b
 WHERE a.contractor_id=b.contractor_id AND a.month=b.month AND a.year=b.year AND a.id>b.id;
CREATE UNIQUE INDEX IF NOT EXISTS contractor_leaderboard_period_unique
  ON contractor_leaderboard_stats (contractor_id, month, year);

CREATE OR REPLACE FUNCTION refresh_contractor_recommendation_projection(target_id varchar)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  positive_count integer;
  negative_count integer;
  total_count integer;
BEGIN
  -- Every writer acquires this same row lock before reading projection inputs.
  -- Later commands in this volatile function see commits made while waiting.
  PERFORM 1 FROM contractors WHERE id=target_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) FILTER (WHERE r.recommendation_type='positive'),
         count(*) FILTER (WHERE r.recommendation_type='negative'), count(*)
    INTO positive_count, negative_count, total_count
    FROM recommendations r JOIN users u ON u.id=r.user_id
   WHERE r.contractor_id=target_id AND r.is_public IS TRUE
     AND r.moderation_status='approved' AND r.is_verified IS TRUE
     AND r.recommendation_type IN ('positive','negative')
     AND u.email_verified IS TRUE AND length(trim(u.email))>0
     AND lower(trim(u.email))=lower(trim(r.customer_email))
     AND coalesce(to_jsonb(u)->>'is_active','true')<>'false';

  UPDATE contractors SET positive_recommendations=positive_count,
    negative_recommendations=negative_count, total_recommendations=total_count,
    recommendation_score=positive_count-negative_count,
    recommendation_percentage=CASE WHEN total_count=0 THEN 0 ELSE round(positive_count*100.0/total_count,2) END,
    updated_at=now() WHERE id=target_id;

  -- Monthly credit follows the immutable submission date, and only appears
  -- while that recommendation remains eligible for publication.
  DELETE FROM contractor_leaderboard_stats WHERE contractor_id=target_id;
  IF total_count=0 THEN RETURN; END IF;
  INSERT INTO contractor_leaderboard_stats (
    contractor_id, month, year, monthly_positive_recommendations,
    monthly_negative_recommendations, monthly_total_recommendations,
    monthly_recommendation_score, monthly_recommendation_percentage,
    lifetime_positive_recommendations, lifetime_negative_recommendations,
    lifetime_total_recommendations, lifetime_recommendation_score,
    lifetime_recommendation_percentage, last_updated
  )
  WITH visible AS (
    SELECT r.recommendation_type, coalesce(r.created_at, now()) AS submitted_at
      FROM recommendations r JOIN users u ON u.id=r.user_id
     WHERE r.contractor_id=target_id AND r.is_public IS TRUE
       AND r.moderation_status='approved' AND r.is_verified IS TRUE
       AND r.recommendation_type IN ('positive','negative')
       AND u.email_verified IS TRUE AND length(trim(u.email))>0
       AND lower(trim(u.email))=lower(trim(r.customer_email))
       AND coalesce(to_jsonb(u)->>'is_active','true')<>'false'
  ), periods AS (
    SELECT date_trunc('month', submitted_at) AS period FROM visible
    UNION SELECT date_trunc('month', now())
  ), monthly AS (
    SELECT p.period,
      count(v.recommendation_type) FILTER (WHERE v.recommendation_type='positive') AS positive,
      count(v.recommendation_type) FILTER (WHERE v.recommendation_type='negative') AS negative,
      count(v.recommendation_type) AS total
    FROM periods p LEFT JOIN visible v ON date_trunc('month',v.submitted_at)=p.period
    GROUP BY p.period
  )
  SELECT target_id, extract(month FROM period)::integer, extract(year FROM period)::integer,
    positive, negative, total, positive-negative,
    CASE WHEN total=0 THEN 0 ELSE round(positive*100.0/total,2) END,
    positive_count, negative_count, total_count, positive_count-negative_count,
    round(positive_count*100.0/total_count,2), now()
  FROM monthly;
END;
$$;

CREATE OR REPLACE FUNCTION sync_recommendation_publication_projection()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id varchar;
BEGIN
  FOR target_id IN
    SELECT DISTINCT value FROM unnest(ARRAY[
      CASE WHEN TG_OP<>'INSERT' THEN OLD.contractor_id END,
      CASE WHEN TG_OP<>'DELETE' THEN NEW.contractor_id END
    ]) AS target(value) WHERE value IS NOT NULL ORDER BY value
  LOOP
    PERFORM refresh_contractor_recommendation_projection(target_id);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS recommendation_publication_projection ON recommendations;
CREATE TRIGGER recommendation_publication_projection
AFTER INSERT OR DELETE OR UPDATE OF contractor_id, user_id, recommendation_type,
  is_public, moderation_status, is_verified, customer_email, created_at
ON recommendations FOR EACH ROW EXECUTE FUNCTION sync_recommendation_publication_projection();
COMMENT ON TRIGGER recommendation_publication_projection ON recommendations
  IS 'tradescout-schema:0136:v1';

CREATE OR REPLACE FUNCTION sync_author_recommendation_publication_projection()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id varchar;
BEGIN
  IF TG_OP='UPDATE' AND OLD.email IS NOT DISTINCT FROM NEW.email
     AND OLD.email_verified IS NOT DISTINCT FROM NEW.email_verified
     AND (to_jsonb(OLD)->'is_active') IS NOT DISTINCT FROM (to_jsonb(NEW)->'is_active') THEN
    RETURN NULL;
  END IF;
  FOR target_id IN SELECT DISTINCT contractor_id FROM recommendations
    WHERE user_id=OLD.id ORDER BY contractor_id
  LOOP
    PERFORM refresh_contractor_recommendation_projection(target_id);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS author_recommendation_publication_projection ON users;
CREATE TRIGGER author_recommendation_publication_projection AFTER UPDATE OR DELETE
ON users FOR EACH ROW EXECUTE FUNCTION sync_author_recommendation_publication_projection();
COMMENT ON TRIGGER author_recommendation_publication_projection ON users
  IS 'tradescout-schema:0136:v1';

DO $$
DECLARE target_id varchar;
BEGIN
  FOR target_id IN SELECT id FROM contractors ORDER BY id LOOP
    PERFORM refresh_contractor_recommendation_projection(target_id);
  END LOOP;
END;
$$;
