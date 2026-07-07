import { hashPassword } from "../server/auth";
import { db } from "../server/db";
import { businessCounties, businesses, counties, users } from "../shared/schema";
import { CURRENT_PROFILE_VERSION } from "../shared/profile";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

function buildStableBusinessSlug(email: string): string {
  const local = String(email || "")
    .split("@")[0]
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 24);
  const digest = createHash("sha1").update(email.toLowerCase()).digest("hex").slice(0, 8);
  return `${local || "e2e-user"}-${digest}`;
}

function buildE2EProfileDraft() {
  return {
    businessName: "Test Business",
    description: "We are a test business serving the community.",
    countyFips: "04013",
    countyName: "Maricopa County",
    stateCode: "AZ",
    city: "Phoenix",
    website: "https://example.com",
    services: ["Direct Connect test routing", "Local repair coordination"],
    serviceAreas: [{ countyFips: "04013" }],
    visibility: "public",
  };
}

async function upsertE2EBusiness(
  userId: string,
  businessSlug: string,
  profileDraft: ReturnType<typeof buildE2EProfileDraft>
) {
  const [business] = await db
    .insert(businesses)
    .values({
      name: profileDraft.businessName,
      slug: businessSlug,
      type: "contractor",
      ownerUserId: userId,
      roleContext: "business_owner",
      profileData: {
        tagline: "Seed profile for TradeScout regression checks.",
        description: profileDraft.description,
        category: "home-services",
        services: profileDraft.services,
        website: profileDraft.website,
        city: profileDraft.city,
        stateCode: profileDraft.stateCode,
      },
      claimStatus: "claimed",
      publicDiscoveryEnabled: true,
      sources: ["e2e_seed"],
      status: "active",
    })
    .onConflictDoUpdate({
      target: businesses.slug,
      set: {
        name: profileDraft.businessName,
        ownerUserId: userId,
        profileData: {
          tagline: "Seed profile for TradeScout regression checks.",
          description: profileDraft.description,
          category: "home-services",
          services: profileDraft.services,
          website: profileDraft.website,
          city: profileDraft.city,
          stateCode: profileDraft.stateCode,
        },
        claimStatus: "claimed",
        publicDiscoveryEnabled: true,
        sources: ["e2e_seed"],
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning({ id: businesses.id });

  const businessId = business?.id;
  if (!businessId) return;

  const [county] = await db
    .select({ id: counties.id })
    .from(counties)
    .where(eq(counties.fips, profileDraft.countyFips))
    .limit(1);

  if (!county?.id) return;

  await db
    .insert(businessCounties)
    .values({
      businessId,
      countyId: county.id,
    })
    .onConflictDoNothing();
}

async function main() {
  const email = process.env.E2E_EMAIL || process.env.MASTER_ADMIN_EMAIL;
  const plaintext = process.env.E2E_PASSWORD || process.env.MASTER_ADMIN_PASSWORD;

  if (!email || !plaintext) {
    console.log(
      "[seed-e2e-user] E2E_EMAIL/E2E_PASSWORD (or MASTER_ADMIN_*) not set; skipping seed."
    );
    return;
  }

  const businessSlug = buildStableBusinessSlug(email);
  const profileDraft = buildE2EProfileDraft();
  const password = await hashPassword(plaintext);

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing.length) {
    console.log(`[seed-e2e-user] User ${email} already exists. Updating profile data...`);
    await db
      .update(users)
      .set({
        password,
        businessSlug,
        role: "business_owner",
        activeRole: "business_owner",
        onboardingCompleted: true,
        profileVersion: CURRENT_PROFILE_VERSION,
        firstName: existing[0].firstName || "Test",
        lastName: existing[0].lastName || "Business",
        phone: existing[0].phone || "+15555550123",
        city: "Phoenix",
        stateCode: "AZ",
        countyFips: "04013",
        locationCommitted: true,
        emailVerified: true,
        addressVerified: true,
        preferences: {
          provisional: {
            profileDraft: {
              ...profileDraft,
            },
          },
        },
      })
      .where(eq(users.email, email));
    await upsertE2EBusiness(existing[0].id, businessSlug, profileDraft);
    console.log(`[seed-e2e-user] Updated user ${email} with business profile '${businessSlug}'.`);
    return;
  }

  // Create user with business profile data for E2E tests
  const [createdUser] = await db
    .insert(users)
    .values({
      email,
      password,
      businessSlug,
      firstName: "Test",
      lastName: "Business",
      phone: "+15555550123",
      role: "business_owner",
      activeRole: "business_owner",
      onboardingCompleted: true,
      profileVersion: CURRENT_PROFILE_VERSION,
      city: "Phoenix",
      stateCode: "AZ",
      countyFips: "04013",
      locationCommitted: true,
      emailVerified: true,
      addressVerified: true,
      preferences: {
        provisional: {
          profileDraft: {
            ...profileDraft,
          },
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: users.id });

  if (createdUser?.id) {
    await upsertE2EBusiness(createdUser.id, businessSlug, profileDraft);
  }

  console.log(
    `[seed-e2e-user] Seeded user ${email} for E2E login with business profile '${businessSlug}'.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-e2e-user] Failed to seed E2E user:", err);
    process.exit(1);
  });
