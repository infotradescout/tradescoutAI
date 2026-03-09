import { describe, expect, it } from "vitest";
import { db } from "../db";
import { storage } from "../storage";
import { buyerVerifications, counties, marketplaceCategories, users } from "@shared/schema";
import { createAuthedAgent } from "./helpers/testAuth";

const hasTestDb =
  Boolean(process.env.TEST_DATABASE_URL) && process.env.RUN_INTEGRATION_TESTS === "true";

const describeDb = hasTestDb ? describe : describe.skip;

async function seedApprovedMarketplaceVerification(userId: string) {
  await db.insert(buyerVerifications).values({
    userId,
    status: "approved",
    addressVerified: true,
    identityVerified: true,
    isOver18: true,
    isOver21: true,
  } as any);
}

async function seedMarketplaceCategory() {
  const [category] = await db
    .insert(marketplaceCategories)
    .values({
      name: `Phase2B ${crypto.randomUUID()}`,
      description: "Phase 2B ingress hardening test category",
      iconName: "tools",
    } as any)
    .returning();

  return category;
}

async function getCountyFixture() {
  const [county] = await db
    .select({
      fips: counties.fips,
      stateCode: counties.stateCode,
      name: counties.name,
    })
    .from(counties)
    .limit(1);

  if (!county) {
    throw new Error("Phase 2B integration tests require at least one seeded county record");
  }

  return county;
}

describeDb("Phase 2B ingress hardening", () => {
  it("marketplace create rejects duplicate seller canonical listing", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "homeowner",
      addressVerified: true,
    });
    const category = await seedMarketplaceCategory();
    await seedApprovedMarketplaceVerification(String(user.id));

    const payload = {
      categoryId: category.id,
      title: "  Delta Table Saw  ",
      description: "Garage-kept cabinet saw with fence and sled.",
      price: "1250.00",
      county: "Ascension Parish",
      state: "la",
      condition: "good",
      isLocalPickupOnly: true,
      willShip: false,
    };

    const first = await agent.post("/api/marketplace/listings").send(payload);
    expect(first.status).toBe(201);

    const duplicate = await agent.post("/api/marketplace/listings").send({
      ...payload,
      title: "delta   table saw",
      description: "Same saw, same county, same price.",
      state: "LA",
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body?.reasonCode).toBe("DUPLICATE_MARKETPLACE_LISTING");
  });

  it("marketplace update ignores protected fields and scrubs contact-bearing text", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "homeowner",
      addressVerified: true,
    });
    const category = await seedMarketplaceCategory();
    await seedApprovedMarketplaceVerification(String(user.id));

    const created = await agent.post("/api/marketplace/listings").send({
      categoryId: category.id,
      title: "Portable generator ready for storm season",
      description: "Low hours and runs clean.",
      price: "750.00",
      county: "Ascension Parish",
      state: "LA",
      condition: "good",
      isLocalPickupOnly: true,
      willShip: false,
    });

    expect(created.status).toBe(201);

    const update = await agent.put(`/api/marketplace/listings/${created.body.id}`).send({
      title: "Call 985-555-0199 for the generator",
      description: "owner@example.com can answer questions before pickup.",
      status: "active",
      sellerId: "not-the-owner",
      approvedBy: "not-an-admin",
      tags: ["Reach me at owner@example.com", "storm-ready"],
    });

    expect(update.status).toBe(200);
    expect(String(update.body?.sellerId || "")).toBe(String(user.id));
    expect(String(update.body?.status || "")).toBe("pending_approval");
    expect(update.body?.approvedBy ?? null).toBeNull();
    expect(String(update.body?.title || "")).not.toContain("985-555-0199");
    expect(String(update.body?.title || "")).toContain("[hidden]");
    expect(String(update.body?.description || "")).not.toContain("owner@example.com");
    expect(String(update.body?.description || "")).toContain("[hidden]");
    expect(Array.isArray(update.body?.tags)).toBe(true);
    expect(String(update.body?.tags?.[0] || "")).toContain("[hidden]");
  });

  it("homescout manual create rejects duplicate canonical property record", async () => {
    const { agent } = await createAuthedAgent({ role: "homeowner", addressVerified: true });
    const county = await getCountyFixture();

    const first = await agent.post("/api/homescout/listings").send({
      countyFips: county.fips,
      stateCode: county.stateCode,
      city: county.name,
      zipCode: "70737",
      address1: "101 Oak Meadow Lane",
      title: "Oak Meadow listing with fresh paint",
      description: "Well-kept property with fenced yard.",
      price: 285000,
      propertyType: "house",
    });

    expect(first.status).toBe(201);

    const duplicate = await agent.post("/api/homescout/listings").send({
      countyFips: county.fips,
      stateCode: county.stateCode,
      city: county.name,
      zipCode: "70737",
      address1: "101 Oak Meadow Lane",
      title: "Same home with updated copy",
      description: "Different marketing text, same property anchor.",
      price: 289000,
      propertyType: "house",
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body?.reasonCode).toBe("DUPLICATE_HOMESCOUT_LISTING");
  });

  it("homescout create scrubs contact-bearing text before persistence", async () => {
    const { agent } = await createAuthedAgent({ role: "homeowner", addressVerified: true });
    const county = await getCountyFixture();

    const created = await agent.post("/api/homescout/listings").send({
      countyFips: county.fips,
      stateCode: county.stateCode,
      city: county.name,
      zipCode: "70810",
      address1: `202 Cypress Trace ${crypto.randomUUID().slice(0, 8)}`,
      title: "Call 985-555-0101 about this Cypress Trace property",
      description: "Reach owner@example.com for a showing request.",
      price: 315000,
      propertyType: "house",
      features: ["Email owner@example.com for disclosures", "Large fenced yard"],
    });

    expect(created.status).toBe(201);

    const stored = await storage.getHomeScoutListing(String(created.body?.id || ""));
    expect(stored).toBeTruthy();
    expect(String((stored as any)?.title || "")).not.toContain("985-555-0101");
    expect(String((stored as any)?.title || "")).toContain("[hidden]");
    expect(String((stored as any)?.description || "")).not.toContain("owner@example.com");
    expect(String((stored as any)?.description || "")).toContain("[hidden]");
    expect(String((stored as any)?.features?.[0] || "")).toContain("[hidden]");
  });

  it("homescout update scrubs contact-bearing text while preserving canonical ownership", async () => {
    const { agent, user } = await createAuthedAgent({ role: "homeowner", addressVerified: true });
    const county = await getCountyFixture();

    const created = await agent.post("/api/homescout/listings").send({
      countyFips: county.fips,
      stateCode: county.stateCode,
      city: county.name,
      zipCode: "70458",
      address1: `909 Lakeview Drive ${crypto.randomUUID().slice(0, 8)}`,
      title: "Lakeview property with screened porch",
      description: "Quiet street and updated flooring.",
      price: 355000,
      propertyType: "house",
    });

    expect(created.status).toBe(201);

    const updated = await agent.patch(`/api/homescout/listings/${created.body.id}`).send({
      title: "Call 225-555-0110 for the Lakeview property",
      description: "owner@example.com handles the showing calendar.",
      sellerUserId: "other-user",
      features: ["Text 225-555-0110 for details", "Covered porch"],
    });

    expect(updated.status).toBe(200);
    expect(String(updated.body?.sellerUserId || "")).toBe(String(user.id));
    expect(String(updated.body?.title || "")).not.toContain("225-555-0110");
    expect(String(updated.body?.title || "")).toContain("[hidden]");
    expect(String(updated.body?.description || "")).not.toContain("owner@example.com");
    expect(String(updated.body?.description || "")).toContain("[hidden]");
    expect(String(updated.body?.features?.[0] || "")).toContain("[hidden]");
  });
});
