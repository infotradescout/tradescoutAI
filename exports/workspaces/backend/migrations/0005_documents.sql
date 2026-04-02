-- Job documents and signatures for invoicing/contract workflow

CREATE TABLE IF NOT EXISTS documents (
	id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	job_id varchar NULL,
	type varchar NOT NULL CHECK (type IN ('MATERIAL_LIST','ESTIMATE','CONTRACT','INVOICE','RECEIPT')),
	status varchar NOT NULL,
	version integer NOT NULL DEFAULT 1,
	payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_by varchar NOT NULL,
	created_at timestamp NOT NULL DEFAULT now(),
	updated_at timestamp NOT NULL DEFAULT now(),
	share_token varchar NULL UNIQUE,
	signed_at timestamp NULL
);

-- Link documents to jobs (projects). Under the hood this uses the existing leads table,
-- but the application should treat these as jobs/projects, not "leads".
ALTER TABLE documents
	ADD CONSTRAINT documents_job_fk FOREIGN KEY (job_id) REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS documents_job_id_idx ON documents(job_id);
CREATE INDEX IF NOT EXISTS documents_type_idx ON documents(type);
CREATE INDEX IF NOT EXISTS documents_share_token_idx ON documents(share_token);

CREATE TABLE IF NOT EXISTS document_signatures (
	id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	document_id varchar NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
	role varchar NOT NULL CHECK (role IN ('homeowner','contractor')),
	user_id varchar NOT NULL,
	signed_at timestamp NOT NULL DEFAULT now(),
	ip varchar NOT NULL,
	signature_type varchar NOT NULL CHECK (signature_type IN ('typed','drawn')),
	typed_name varchar NULL,
	drawing_data text NULL
);

CREATE INDEX IF NOT EXISTS document_signatures_doc_idx ON document_signatures(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS document_signatures_unique_role ON document_signatures(document_id, role);

CREATE OR REPLACE FUNCTION set_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS documents_updated_at_trg ON documents;
CREATE TRIGGER documents_updated_at_trg
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_documents_updated_at();
