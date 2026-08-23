import { eq, sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { isPublicAndCrawlableBusinessDetail } from "@shared/publication";
import { db } from "../db";
import { storage } from "../storage";
import { getPublicationRules } from "../publicationRules";
import {
  buildPublicBusinessSignals,
  canServePublicBusinessDetail,
  derivePublicationTier,
} from "../publicationBusiness";
import {
  buildPublicDirectoryProfile,
  hasPublicDirectoryOfferingFacts,
} from "./publicDirectoryBusinessPresentation";
import { assertSeoDirectorySnapshotReady } from "./seoDirectoryNavigationService";

export type PublicDirectoryBusinessDetailResult = {
  status: 200 | 400 | 404 | 410 | 503;
  body: Record<string, unknown>;
};

/** Canonical anonymous hydration owner for /api/public/businesses/:slug. */
export async function loadPublicDirectoryBusinessBySlug(args: {
  slug: unknown;
  now?: Date;
}): Promise<PublicDirectoryBusinessDetailResult> {
  const slug = typeof args.slug === "string" ? args.slug.trim() : "";
  if (!slug) return { status: 400, body: { message: "Invalid business slug" } };

  await assertSeoDirectorySnapshotReady();

  const business = await storage.getBusinessBySlugPublic(slug);
  if (!business || business.status !== ("active" as any)) {
    return { status: 404, body: { message: "Business not found" } };
  }

  const snapshotResult = await db.execute(sql`
    select
      snapshot.business_id,
      snapshot.display_name,
      snapshot.trade_slug,
      snapshot.tier,
      snapshot.claim_status,
      snapshot.primary_state_code,
      snapshot.city_slug,
      membership.is_primary,
      county.id as county_id,
      county.name as county_name,
      county.state_code,
      county.fips
    from ts_seo_directory_business_pages snapshot
    inner join ts_seo_directory_business_counties membership
      on membership.business_id = snapshot.business_id
    inner join counties county on county.id = membership.county_id
    where snapshot.slug = ${slug}
    order by
      membership.is_primary desc,
      (county.state_code = snapshot.primary_state_code) desc,
      county.state_code,
      county.name,
      county.fips;
  `);
  const snapshotRows = Array.isArray((snapshotResult as any)?.rows)
    ? (snapshotResult as any).rows
    : [];
  if (!snapshotRows.length || String(snapshotRows[0]?.business_id || "") !== String(business.id)) {
    return {
      status: 410,
      body: { message: "Listing is not in the published directory generation" },
    };
  }

  const publicProfile = buildPublicDirectoryProfile(business.profileData || {});
  const publicName = String(snapshotRows[0]?.display_name || "").trim();
  const tradeSlug = String(snapshotRows[0]?.trade_slug || "").trim() || null;
  const countyRows = snapshotRows.map((row: any) => ({
    id: String(row.county_id || ""),
    name: String(row.county_name || ""),
    stateCode: String(row.state_code || "").toUpperCase(),
    fips: String(row.fips || ""),
  }));

  const ownerUserId = (business as any).ownerUserId ? String((business as any).ownerUserId) : null;
  let ownerVerificationStatus: string | null = null;
  let ownerAddressVerified: boolean | null = null;
  if (ownerUserId) {
    const ownerRows = await db
      .select({
        verificationStatus: users.verificationStatus,
        addressVerified: users.addressVerified,
      })
      .from(users)
      .where(eq(users.id, ownerUserId))
      .limit(1);
    ownerVerificationStatus = ownerRows[0]?.verificationStatus
      ? String(ownerRows[0].verificationStatus)
      : null;
    ownerAddressVerified =
      typeof ownerRows[0]?.addressVerified === "boolean" ? ownerRows[0].addressVerified : null;
  }

  const tier = derivePublicationTier({
    ownerUserId,
    claimStatus: String((business as any).claimStatus || ""),
    ownerVerificationStatus,
    ownerAddressVerified,
  });
  const primaryCounty = countyRows[0] || null;
  const primaryStateCode = primaryCounty?.stateCode
    ? String(primaryCounty.stateCode).trim().toUpperCase()
    : null;
  const city =
    primaryStateCode && publicProfile.stateCode === primaryStateCode
      ? publicProfile.city || null
      : null;
  const governedPublicProfile = {
    ...publicProfile,
    city: city || undefined,
    stateCode: primaryStateCode || undefined,
  };
  const rules = await getPublicationRules();
  const publication = isPublicAndCrawlableBusinessDetail(
    buildPublicBusinessSignals({
      id: String(business.id),
      name: publicName,
      slug: String(business.slug || ""),
      updatedAt:
        (business as any).updatedAt instanceof Date
          ? (business as any).updatedAt
          : new Date(Number.NaN),
      publicDiscoveryEnabled: Boolean((business as any).publicDiscoveryEnabled),
      stateCode: primaryStateCode,
      countyName: primaryCounty?.name ? String(primaryCounty.name) : null,
      city,
      tradeSlug,
      hasPublicOfferingFacts: hasPublicDirectoryOfferingFacts(publicProfile),
      tier,
    }),
    rules,
    args.now || new Date()
  );

  if (!canServePublicBusinessDetail({ publication, tier })) {
    return { status: 410, body: { message: "Listing inactive/out of date" } };
  }

  return {
    status: 200,
    body: {
      id: business.id,
      name: publicName,
      slug: business.slug,
      type: business.type,
      roleContext: business.roleContext,
      status: business.status,
      claimStatus: (business as any).claimStatus,
      profile: governedPublicProfile,
      counties: countyRows,
      publication: {
        crawlable: publication.ok,
        reason: publication.reason || null,
        tier: tier === "verified" ? "verified" : "unclaimed",
      },
    },
  };
}
