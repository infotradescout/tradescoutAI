-- `social_posts` was a legacy table created outside the journal. Current fresh
-- databases use `community_posts`, while some upgraded databases still retain
-- the legacy table. Preserve the legacy save table only where its parent exists.
DO $migration$
BEGIN
  IF to_regclass('public.social_posts') IS NULL THEN
    RAISE NOTICE 'Skipping legacy social_post_saves compatibility: social_posts is absent';
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE TABLE IF NOT EXISTS public.social_post_saves (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      post_id varchar NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now()
    )
  $ddl$;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS social_post_saves_user_post_uidx
    ON public.social_post_saves(user_id, post_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_social_post_saves_user
    ON public.social_post_saves(user_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_social_post_saves_post
    ON public.social_post_saves(post_id)';
END
$migration$;
