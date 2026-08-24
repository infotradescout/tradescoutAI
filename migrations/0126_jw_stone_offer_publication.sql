-- Publish only the seven seller-confirmed JW Stone positions as unpriced,
-- offer-first BidRock listings. The release fails closed if custody, freshness,
-- entitlement, reservation, price, or auction state has changed.
DO $$
DECLARE
  jw_fixture_version CONSTANT TEXT := 'jw-stone-confirmed-stock-2026-08-20-v1';
  jw_business_id TEXT;
  jw_publisher_user_id TEXT;
  jw_target_count INTEGER;
  jw_eligible_count INTEGER;
  jw_inventory_update_count INTEGER;
  jw_listing_update_count INTEGER;
BEGIN
  SELECT profile.business_id, business.owner_user_id
    INTO jw_business_id, jw_publisher_user_id
    FROM profiles AS profile
    INNER JOIN businesses AS business ON business.id = profile.business_id
   WHERE profile.slug = 'jw-stone'
   LIMIT 1;

  IF jw_business_id IS NULL OR jw_publisher_user_id IS NULL THEN
    RAISE EXCEPTION
      '0126 requires the canonical JW Stone profile, business, and owner before publication';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM profile_accounts AS account
      INNER JOIN profile_account_entitlements AS entitlement
        ON entitlement.profile_account_id = account.id
      INNER JOIN user_profiles AS business_profile
        ON business_profile.id = account.business_profile_id
     WHERE account.owner_user_id = jw_publisher_user_id
       AND account.target_profile_id = (
         SELECT id FROM profiles WHERE slug = 'jw-stone' LIMIT 1
       )
       AND account.target_business_id = jw_business_id
       AND account.identity_kind = 'business'
       AND account.status = 'active'
       AND account.verification_status = 'approved'
       AND business_profile.verification_status = 'approved'
       AND entitlement.product_key = 'bidrock'
       AND entitlement.status = 'active'
  ) THEN
    RAISE EXCEPTION
      '0126 requires JW Stone owner verification and an active BidRock entitlement';
  END IF;

  -- Lock only the canonical fixture rows and their marketplace projections.
  PERFORM inventory_row.id
    FROM stone_inventory_positions AS inventory_row
    INNER JOIN stone_asset_passports AS passport
      ON passport.id = inventory_row.asset_passport_id
    INNER JOIN bidrock_listings AS listing_row
      ON listing_row.inventory_position_id = inventory_row.id
   WHERE inventory_row.holder_business_id = jw_business_id
     AND listing_row.seller_business_id = jw_business_id
     AND listing_row.source_profile_slug = 'jw-stone'
     AND passport.condition_json ->> 'fixtureVersion' = jw_fixture_version
     AND passport.source_asset_ref LIKE jw_fixture_version || ':%'
   ORDER BY inventory_row.id
   FOR UPDATE OF inventory_row, listing_row;

  SELECT count(*)
    INTO jw_target_count
    FROM stone_inventory_positions AS inventory_row
    INNER JOIN stone_asset_passports AS passport
      ON passport.id = inventory_row.asset_passport_id
    INNER JOIN bidrock_listings AS listing_row
      ON listing_row.inventory_position_id = inventory_row.id
   WHERE inventory_row.holder_business_id = jw_business_id
     AND listing_row.seller_business_id = jw_business_id
     AND listing_row.source_profile_slug = 'jw-stone'
     AND passport.condition_json ->> 'fixtureVersion' = jw_fixture_version
     AND passport.source_asset_ref LIKE jw_fixture_version || ':%';

  IF jw_target_count <> 7 THEN
    RAISE EXCEPTION
      '0126 expected exactly 7 canonical JW Stone lots but found %',
      jw_target_count;
  END IF;

  SELECT count(*)
    INTO jw_eligible_count
    FROM stone_inventory_positions AS inventory_row
    INNER JOIN stone_asset_passports AS passport
      ON passport.id = inventory_row.asset_passport_id
    INNER JOIN bidrock_listings AS listing_row
      ON listing_row.inventory_position_id = inventory_row.id
   WHERE inventory_row.holder_business_id = jw_business_id
     AND listing_row.seller_business_id = jw_business_id
     AND listing_row.source_profile_slug = 'jw-stone'
     AND passport.condition_json ->> 'fixtureVersion' = jw_fixture_version
     AND passport.source_asset_ref LIKE jw_fixture_version || ':%'
     AND passport.passport_status = 'verified'
     AND inventory_row.lifecycle_status = 'available'
     AND inventory_row.quantity > 0
     AND inventory_row.held_quantity = 0
     AND inventory_row.public_availability_status IN ('not_published', 'published_current')
     AND listing_row.status IN ('draft', 'active')
     AND listing_row.archived_at IS NULL
     AND listing_row.price_unit IS NULL
     AND listing_row.price_cents IS NULL
     AND listing_row.last_confirmed_at <= NOW()
     AND listing_row.confirmation_expires_at > NOW()
     AND listing_row.last_confirmed_at + INTERVAL '45 days' > NOW()
     AND NOT EXISTS (
       SELECT 1
         FROM bidrock_auctions AS auction
        WHERE auction.listing_id = listing_row.id
          AND auction.status IN ('scheduled', 'live', 'extended', 'ended')
     );

  IF jw_eligible_count <> 7 THEN
    RAISE EXCEPTION
      '0126 publication gate accepted % of 7 JW Stone lots; custody, freshness, hold, price, or auction state changed',
      jw_eligible_count;
  END IF;

  UPDATE stone_inventory_positions AS inventory_row
     SET public_availability_status = 'published_current',
         publication_evidence = CASE
           WHEN inventory_row.public_availability_status = 'published_current'
             AND inventory_row.publication_evidence ->> 'type' = 'bidrock_seller_publication'
             THEN inventory_row.publication_evidence
           ELSE jsonb_build_object(
             'type', 'bidrock_seller_publication',
             'actorUserId', jw_publisher_user_id,
             'recordedAt', NOW(),
             'releaseControl', '0126_jw_stone_offer_publication',
             'fixtureVersion', jw_fixture_version,
             'commercialMode', 'private_offer_without_asking_price'
           )
         END,
         published_at = COALESCE(inventory_row.published_at, NOW()),
         version = inventory_row.version + 1,
         updated_at = NOW()
    FROM stone_asset_passports AS passport,
         bidrock_listings AS listing_row
   WHERE passport.id = inventory_row.asset_passport_id
     AND listing_row.inventory_position_id = inventory_row.id
     AND inventory_row.holder_business_id = jw_business_id
     AND listing_row.seller_business_id = jw_business_id
     AND listing_row.source_profile_slug = 'jw-stone'
     AND passport.condition_json ->> 'fixtureVersion' = jw_fixture_version
     AND passport.source_asset_ref LIKE jw_fixture_version || ':%';

  GET DIAGNOSTICS jw_inventory_update_count = ROW_COUNT;
  IF jw_inventory_update_count <> 7 THEN
    RAISE EXCEPTION
      '0126 updated % of 7 canonical inventory positions',
      jw_inventory_update_count;
  END IF;

  UPDATE bidrock_listings AS listing_row
     SET status = 'active',
         published_at = COALESCE(listing_row.published_at, NOW()),
         version = listing_row.version + 1,
         updated_at = NOW()
    FROM stone_inventory_positions AS inventory_row,
         stone_asset_passports AS passport
   WHERE inventory_row.id = listing_row.inventory_position_id
     AND passport.id = inventory_row.asset_passport_id
     AND inventory_row.holder_business_id = jw_business_id
     AND listing_row.seller_business_id = jw_business_id
     AND listing_row.source_profile_slug = 'jw-stone'
     AND inventory_row.public_availability_status = 'published_current'
     AND listing_row.price_unit IS NULL
     AND listing_row.price_cents IS NULL
     AND passport.condition_json ->> 'fixtureVersion' = jw_fixture_version
     AND passport.source_asset_ref LIKE jw_fixture_version || ':%';

  GET DIAGNOSTICS jw_listing_update_count = ROW_COUNT;
  IF jw_listing_update_count <> 7 THEN
    RAISE EXCEPTION
      '0126 activated % of 7 canonical BidRock listings',
      jw_listing_update_count;
  END IF;
END;
$$;
