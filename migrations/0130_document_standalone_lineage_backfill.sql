-- Legacy accounting records used synthetic acct_* values in the documents.job_id
-- foreign-key slot. Profile-offer purchase receipts used the same convention, so
-- classify only rows whose prefix, source, type, and payload agree. A single DO
-- statement keeps the lock, preflight, rewrites, and invariant installation atomic
-- even when a migration runner does not add its own transaction wrapper.
DO $$
DECLARE
  conflicting_rows bigint;
BEGIN
  -- Block legacy application writers until the canonical CHECK constraint is
  -- installed. Writers that were already waiting resume after commit and are
  -- rejected if they still try to put an acct_* value in documents.job_id.
  LOCK TABLE documents IN ACCESS EXCLUSIVE MODE;

  SELECT count(*)
    INTO conflicting_rows
    FROM documents AS legacy_document
   WHERE left(legacy_document.job_id, 5) = 'acct_'
     AND (
       jsonb_typeof(legacy_document.payload) IS DISTINCT FROM 'object'
       OR jsonb_typeof(legacy_document.permissions) IS DISTINCT FROM 'object'
       OR (
         legacy_document.payload ? 'accountingGroupId'
         AND legacy_document.payload ->> 'accountingGroupId'
           IS DISTINCT FROM legacy_document.job_id
       )
       OR EXISTS (
         SELECT 1
           FROM leads AS referenced_lead
          WHERE referenced_lead.id = legacy_document.job_id
       )
       OR CASE
         WHEN left(legacy_document.job_id, length('acct_profile_order_')) =
           'acct_profile_order_' THEN
           legacy_document.type IS DISTINCT FROM 'RECEIPT'
           OR legacy_document.permissions ->> 'source'
             IS DISTINCT FROM 'profile_offer_purchase'
           OR (
             legacy_document.permissions ? 'lineageKind'
             AND legacy_document.permissions ->> 'lineageKind'
               IS DISTINCT FROM 'profile_offer_purchase'
           )
           OR jsonb_typeof(legacy_document.payload -> 'profileOfferId')
             IS DISTINCT FROM 'string'
           OR jsonb_typeof(legacy_document.payload -> 'profileOfferPurchaseId')
             IS DISTINCT FROM 'string'
           OR jsonb_typeof(legacy_document.payload -> 'buyerUserId')
             IS DISTINCT FROM 'string'
           OR jsonb_typeof(legacy_document.payload -> 'sellerUserId')
             IS DISTINCT FROM 'string'
           OR nullif(btrim(legacy_document.payload ->> 'profileOfferId'), '') IS NULL
           OR nullif(btrim(legacy_document.payload ->> 'profileOfferPurchaseId'), '') IS NULL
           OR nullif(btrim(legacy_document.payload ->> 'buyerUserId'), '') IS NULL
           OR nullif(btrim(legacy_document.payload ->> 'sellerUserId'), '') IS NULL
           OR length(btrim(legacy_document.payload ->> 'profileOfferId')) > 256
           OR length(btrim(legacy_document.payload ->> 'profileOfferPurchaseId')) > 256
           OR length(btrim(legacy_document.payload ->> 'buyerUserId')) > 256
           OR length(btrim(legacy_document.payload ->> 'sellerUserId')) > 256
           OR nullif(
             left(
               regexp_replace(
                 legacy_document.payload ->> 'profileOfferPurchaseId',
                 '[^a-zA-Z0-9_-]',
                 '',
                 'g'
               ),
               48
             ),
             ''
           ) IS NULL
           OR legacy_document.job_id IS DISTINCT FROM
             'acct_profile_order_' || left(
               regexp_replace(
                 legacy_document.payload ->> 'profileOfferPurchaseId',
                 '[^a-zA-Z0-9_-]',
                 '',
                 'g'
               ),
               48
             )
         ELSE
           legacy_document.type IS NULL
           OR legacy_document.type NOT IN (
             'MATERIAL_LIST',
             'ESTIMATE',
             'CONTRACT',
             'INVOICE',
             'RECEIPT',
             'EXPENSE',
             'BILL',
             'PURCHASE_ORDER',
             'CREDIT_NOTE',
             'PAYMENT',
             'JOURNAL_ENTRY'
           )
           OR legacy_document.permissions ->> 'source' = 'profile_offer_purchase'
           OR (
             legacy_document.permissions ? 'lineageKind'
             AND legacy_document.permissions ->> 'lineageKind'
               IS DISTINCT FROM 'standalone_accounting'
           )
       END
     );

  IF conflicting_rows > 0 THEN
    RAISE EXCEPTION
      'document accounting lineage preflight failed: % legacy acct_* row(s) have ambiguous or conflicting prefix, source, type, payload, grouping, lineage, or a real lead reference; reconcile before rerunning migration 0130',
      conflicting_rows
      USING ERRCODE = '23514',
            HINT = 'Do not overwrite or delete conflicting rows. Verify profile-offer purchase provenance and preserve reviewed accountingGroupId and lineageKind values before retrying.';
  END IF;

  UPDATE documents
     SET payload = jsonb_set(
           payload,
           '{accountingGroupId}',
           to_jsonb(job_id),
           true
         ),
         permissions = jsonb_set(
           permissions,
           '{lineageKind}',
           '"profile_offer_purchase"'::jsonb,
           true
         ),
         job_id = NULL
   WHERE left(job_id, length('acct_profile_order_')) = 'acct_profile_order_'
     AND type = 'RECEIPT'
     AND permissions ->> 'source' = 'profile_offer_purchase';

  UPDATE documents
     SET payload = jsonb_set(
           payload,
           '{accountingGroupId}',
           to_jsonb(job_id),
           true
         ),
         permissions = jsonb_set(
           permissions,
           '{lineageKind}',
           '"standalone_accounting"'::jsonb,
           true
         ),
         job_id = NULL
   WHERE left(job_id, 5) = 'acct_'
     AND left(job_id, length('acct_profile_order_')) <> 'acct_profile_order_';

  ALTER TABLE documents
    DROP CONSTRAINT IF EXISTS documents_job_id_no_synthetic_accounting_check;
  ALTER TABLE documents
    ADD CONSTRAINT documents_job_id_no_synthetic_accounting_check
    CHECK (job_id IS NULL OR left(job_id, 5) <> 'acct_') NOT VALID;
  ALTER TABLE documents
    VALIDATE CONSTRAINT documents_job_id_no_synthetic_accounting_check;
  COMMENT ON CONSTRAINT documents_job_id_no_synthetic_accounting_check ON documents
    IS 'tradescout-schema:0130:v1';
END $$;
