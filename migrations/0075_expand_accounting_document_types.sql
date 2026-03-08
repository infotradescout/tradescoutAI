-- Expand accounting document types for finance-native bookkeeping records.
-- This keeps the existing documents table while allowing additional record classes.

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (
    type IN (
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
  );
