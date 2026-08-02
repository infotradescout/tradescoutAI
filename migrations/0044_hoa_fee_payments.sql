-- The original HOA management tables entered deployed databases through
-- schema push before the numbered migration chain referenced them. Recreate
-- that active baseline for clean journal installs before adding the fee ledger.
CREATE TABLE IF NOT EXISTS public.homeowner_associations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name varchar NOT NULL,
  address text NOT NULL,
  city varchar NOT NULL,
  state varchar NOT NULL,
  county_fips varchar NOT NULL,
  zip_code varchar,
  established_year integer,
  total_units integer NOT NULL,
  monthly_fees numeric(10, 2),
  reserves numeric(12, 2),
  management_company varchar,
  board_members jsonb,
  amenities text[],
  next_meeting timestamp,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hoa_financial_records (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  hoa_id varchar NOT NULL
    REFERENCES public.homeowner_associations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  total_revenue numeric(12, 2),
  total_expenses numeric(12, 2),
  net_income numeric(12, 2),
  reserves numeric(12, 2),
  outstanding_fees numeric(12, 2),
  expense_categories jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hoa_vendors (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  hoa_id varchar NOT NULL
    REFERENCES public.homeowner_associations(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  category varchar NOT NULL,
  contact_person varchar,
  phone varchar,
  email varchar,
  monthly_contract numeric(10, 2),
  contract_start timestamp,
  contract_end timestamp,
  rating numeric(3, 2),
  status varchar DEFAULT 'active',
  services text[],
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hoa_votes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  hoa_id varchar NOT NULL
    REFERENCES public.homeowner_associations(id) ON DELETE CASCADE,
  title varchar NOT NULL,
  description text NOT NULL,
  vote_type varchar NOT NULL,
  created_by varchar NOT NULL REFERENCES public.users(id),
  start_date timestamp NOT NULL,
  end_date timestamp NOT NULL,
  required_quorum integer NOT NULL,
  current_votes integer DEFAULT 0,
  votes_for integer DEFAULT 0,
  votes_against integer DEFAULT 0,
  votes_abstain integer DEFAULT 0,
  estimated_cost numeric(12, 2),
  status varchar DEFAULT 'active',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hoa_vote_responses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  vote_id varchar NOT NULL REFERENCES public.hoa_votes(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision varchar NOT NULL,
  submitted_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hoa_vote_responses_vote
  ON public.hoa_vote_responses(vote_id);
CREATE INDEX IF NOT EXISTS idx_hoa_vote_responses_user
  ON public.hoa_vote_responses(user_id);

CREATE TABLE IF NOT EXISTS public.hoa_service_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  hoa_id varchar NOT NULL
    REFERENCES public.homeowner_associations(id) ON DELETE CASCADE,
  vendor_id varchar NOT NULL REFERENCES public.hoa_vendors(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_type varchar NOT NULL,
  description text NOT NULL,
  urgency varchar DEFAULT 'normal',
  contact_preference varchar DEFAULT 'email',
  status varchar DEFAULT 'submitted',
  assigned_to varchar,
  completed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hoa_documents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  hoa_id varchar NOT NULL
    REFERENCES public.homeowner_associations(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  document_type varchar NOT NULL,
  file_url varchar NOT NULL,
  file_size integer,
  uploaded_by varchar NOT NULL REFERENCES public.users(id),
  is_public boolean DEFAULT false,
  last_updated timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hoa_members (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  hoa_id varchar NOT NULL
    REFERENCES public.homeowner_associations(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  unit_number varchar,
  role varchar NOT NULL DEFAULT 'member',
  joined_at timestamp DEFAULT now(),
  term_start timestamp,
  term_end timestamp,
  is_primary boolean DEFAULT true,
  voting_rights boolean DEFAULT true,
  in_good_standing boolean DEFAULT true,
  can_view_finances boolean DEFAULT false,
  can_edit_documents boolean DEFAULT false,
  can_manage_vendors boolean DEFAULT false,
  can_create_votes boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hoa_members_hoa ON public.hoa_members(hoa_id);
CREATE INDEX IF NOT EXISTS idx_hoa_members_user ON public.hoa_members(user_id);
CREATE INDEX IF NOT EXISTS idx_hoa_members_role ON public.hoa_members(role);

CREATE TABLE IF NOT EXISTS public.hoa_governance (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  hoa_id varchar NOT NULL UNIQUE
    REFERENCES public.homeowner_associations(id) ON DELETE CASCADE,
  governance_model varchar NOT NULL DEFAULT 'elected_board',
  voting_enabled boolean DEFAULT true,
  financials_enabled boolean DEFAULT true,
  vendor_management_enabled boolean DEFAULT true,
  document_library_enabled boolean DEFAULT true,
  residents_directory_enabled boolean DEFAULT true,
  maintenance_requests_enabled boolean DEFAULT true,
  custom_roles jsonb,
  quorum_percentage integer DEFAULT 50,
  vote_pass_threshold integer DEFAULT 51,
  allow_proxy_voting boolean DEFAULT false,
  governance_notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Resident-level HOA fee ledger for auditable fee collection receipts
CREATE TABLE IF NOT EXISTS hoa_fee_payments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hoa_id varchar NOT NULL REFERENCES homeowner_associations(id) ON DELETE CASCADE,
  resident_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  description text NOT NULL,
  collected_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method varchar NOT NULL DEFAULT 'manual',
  external_ref varchar,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hoa_fee_payments_hoa ON hoa_fee_payments(hoa_id);
CREATE INDEX IF NOT EXISTS idx_hoa_fee_payments_resident ON hoa_fee_payments(resident_id);
CREATE INDEX IF NOT EXISTS idx_hoa_fee_payments_created_at ON hoa_fee_payments(created_at DESC);
