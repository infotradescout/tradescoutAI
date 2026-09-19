-- Ordered, additive storage for the existing feature flag model.
-- Do not seed or disable the JW control: an absent control preserves ON.
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  key varchar(255) NOT NULL UNIQUE,
  description text,
  enabled boolean DEFAULT false,
  category varchar(100) DEFAULT 'general',
  user_roles text[] DEFAULT ARRAY[]::text[],
  config jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS config jsonb;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_key_control_idx ON public.feature_flags (key);
