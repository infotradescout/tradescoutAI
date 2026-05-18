CREATE TABLE IF NOT EXISTS accounting_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  accounting_basis varchar(16) NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash', 'accrual')),
  fiscal_year_start_month integer NOT NULL DEFAULT 1
    CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  default_currency varchar(3) NOT NULL DEFAULT 'USD',
  books_status varchar(32) NOT NULL DEFAULT 'setup'
    CHECK (books_status IN ('setup', 'active', 'needs_review', 'locked')),
  tax_country varchar(2) NOT NULL DEFAULT 'US',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_profiles_created_by_unique
  ON accounting_profiles (created_by);

CREATE TABLE IF NOT EXISTS accounting_accounts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id varchar NOT NULL REFERENCES accounting_profiles(id) ON DELETE cascade,
  code varchar(32) NOT NULL,
  name varchar(160) NOT NULL,
  account_type varchar(32) NOT NULL
    CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'cogs', 'expense')),
  account_subtype varchar(80),
  normal_balance varchar(8) NOT NULL
    CHECK (normal_balance IN ('debit', 'credit')),
  system_key varchar(80),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_accounts_profile_code_unique
  ON accounting_accounts (profile_id, code);

CREATE INDEX IF NOT EXISTS accounting_accounts_profile_type_idx
  ON accounting_accounts (profile_id, account_type, is_active);

CREATE TABLE IF NOT EXISTS accounting_journal_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id varchar REFERENCES accounting_profiles(id) ON DELETE cascade,
  status varchar(24) NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('draft', 'proposed', 'reviewed', 'posted', 'void')),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  source_surface varchar(32) NOT NULL DEFAULT 'manual'
    CHECK (source_surface IN ('manual', 'direct_connect', 'connections', 'scout', 'exchange', 'homescout', 'finance', 'system')),
  source_type varchar(80),
  source_id varchar,
  work_request_id varchar REFERENCES work_requests(id) ON DELETE SET NULL,
  conversation_id varchar,
  scout_conversation_id varchar REFERENCES scout_conversations(id) ON DELETE SET NULL,
  document_id varchar REFERENCES documents(id) ON DELETE SET NULL,
  description text,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by varchar REFERENCES users(id) ON DELETE SET NULL,
  posted_by varchar REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  posted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_journal_entries_profile_status_idx
  ON accounting_journal_entries (profile_id, status, entry_date DESC);

CREATE INDEX IF NOT EXISTS accounting_journal_entries_source_idx
  ON accounting_journal_entries (source_surface, source_type, source_id);

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id varchar NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE cascade,
  account_id varchar REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  description text,
  debit numeric(12,2) NOT NULL DEFAULT 0,
  credit numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (debit >= 0),
  CHECK (credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX IF NOT EXISTS accounting_journal_lines_entry_idx
  ON accounting_journal_lines (journal_entry_id);

CREATE TABLE IF NOT EXISTS accounting_reconciliation_sessions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id varchar NOT NULL REFERENCES accounting_profiles(id) ON DELETE cascade,
  account_id varchar REFERENCES accounting_accounts(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'reconciled', 'void')),
  period_start date,
  period_end date,
  statement_ending_balance numeric(12,2),
  reconciled_at timestamptz,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_reconciliation_profile_status_idx
  ON accounting_reconciliation_sessions (profile_id, status, period_end DESC);

CREATE TABLE IF NOT EXISTS accounting_audit_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id varchar REFERENCES accounting_profiles(id) ON DELETE cascade,
  actor_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  action varchar(80) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar,
  source_surface varchar(32)
    CHECK (source_surface IN ('manual', 'direct_connect', 'connections', 'scout', 'exchange', 'homescout', 'finance', 'system')),
  source_id varchar,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_audit_profile_created_idx
  ON accounting_audit_events (profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS accounting_automation_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id varchar REFERENCES accounting_profiles(id) ON DELETE SET NULL,
  created_by varchar REFERENCES users(id) ON DELETE SET NULL,
  source_surface varchar(32) NOT NULL
    CHECK (source_surface IN ('direct_connect', 'connections', 'scout', 'exchange', 'homescout', 'finance', 'system')),
  source_type varchar(80) NOT NULL,
  source_id varchar NOT NULL,
  source_event_key varchar NOT NULL,
  work_request_id varchar REFERENCES work_requests(id) ON DELETE SET NULL,
  assignment_id varchar REFERENCES work_request_assignments(id) ON DELETE SET NULL,
  requester_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  provider_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  automation_state varchar(24) NOT NULL DEFAULT 'proposed'
    CHECK (automation_state IN ('proposed', 'reviewed', 'posted', 'skipped', 'error')),
  proposed_document_id varchar REFERENCES documents(id) ON DELETE SET NULL,
  proposed_journal_entry_id varchar REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_automation_source_event_unique
  ON accounting_automation_events (source_event_key);

CREATE INDEX IF NOT EXISTS accounting_automation_profile_state_idx
  ON accounting_automation_events (profile_id, automation_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS accounting_automation_request_idx
  ON accounting_automation_events (work_request_id, assignment_id);
