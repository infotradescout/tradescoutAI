CREATE TABLE IF NOT EXISTS accounting_clients (
  id text PRIMARY KEY,
  created_by text NOT NULL,
  display_name text NOT NULL,
  email text,
  phone text,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_clients_created_by_idx
  ON accounting_clients (created_by, is_archived, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_clients_owner_name_unique
  ON accounting_clients (created_by, lower(display_name));
