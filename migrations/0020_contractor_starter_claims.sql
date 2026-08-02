-- Contractor starter path support
-- The application table entered older databases through schema push rather
-- than the numbered journal. Reconstruct its original shape for clean installs
-- before applying the starter-path additions.
CREATE TABLE IF NOT EXISTS public.contractor_applications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  company_name varchar NOT NULL,
  email varchar NOT NULL,
  phone varchar NOT NULL,
  website varchar,
  primary_state varchar NOT NULL,
  primary_county varchar NOT NULL,
  service_radius varchar NOT NULL,
  years_in_business integer NOT NULL,
  license_number varchar NOT NULL,
  insurance_provider varchar NOT NULL,
  primary_trade varchar NOT NULL,
  specialties jsonb NOT NULL,
  about text NOT NULL,
  preferred_contact varchar NOT NULL,
  agree_to_terms boolean NOT NULL,
  agree_to_verification boolean NOT NULL,
  status varchar DEFAULT 'pending',
  review_notes text,
  reviewed_by varchar,
  reviewed_at timestamp,
  contractor_id varchar,
  submitted_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractor_applications_email
  ON public.contractor_applications(email);
CREATE INDEX IF NOT EXISTS idx_contractor_applications_status
  ON public.contractor_applications(status);
CREATE INDEX IF NOT EXISTS idx_contractor_applications_submitted
  ON public.contractor_applications(submitted_at);

ALTER TABLE public.contractor_applications
  ADD COLUMN IF NOT EXISTS user_id varchar REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS starter_path BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_contractor_applications_user
  ON public.contractor_applications(user_id);
