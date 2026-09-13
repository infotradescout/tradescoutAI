-- A seller's stable CSV listing_id identifies one existing Exchange listing.
-- Scope is seller_id + normalized externalListingId, not just the visible title.
-- Do not delete/merge existing duplicates automatically: CREATE UNIQUE INDEX must
-- fail the deployment if cleanup decisions are needed. All statuses participate.
CREATE UNIQUE INDEX marketplace_listings_seller_import_key_unique
  ON marketplace_listings (
    seller_id,
    lower(btrim(specifications->>'externalListingId'))
  )
  WHERE NULLIF(btrim(specifications->>'externalListingId'), '') IS NOT NULL;
