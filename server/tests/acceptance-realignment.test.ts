import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { createApp } from "../app";
import {
  businesses,
  contractorPromos,
  contractorTrades,
  contractors,
  marketplaceCategories,
  marketplaceConversations,
  marketplaceListings,
  trades,
  users,
} from "@shared/schema";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

if (!hasTestDb) {
  describe.skip("Realignment acceptance tests", () => {
    it("skipped (requires TEST_DATABASE_URL)", () => {});
  });
} else {
  describe("Realignment acceptance tests", () => {
    let app: any;
    let previousMapsFlag: string | undefined;

    beforeAll(async () => {
      previousMapsFlag = process.env.FEATURE_MAPS_V1;
      process.env.FEATURE_MAPS_V1 = "true";
      const created = await createApp();
      app = created.app;
    });

    afterAll(() => {
      process.env.FEATURE_MAPS_V1 = previousMapsFlag;
    });

    it("redacts direct contact on public promo payload", async () => {
      const userId = `promo-user-${crypto.randomUUID()}`;
      const contractorId = `promo-contractor-${crypto.randomUUID()}`;
      const slug = `promo-${crypto.randomUUID()}`;

      await db.insert(users).values({
        id: userId,
        email: `promo+${crypto.randomUUID()}@tradescout.test`,
        firstName: "Promo",
        lastName: "Owner",
        role: "contractor" as any,
        emailVerified: true,
        addressVerified: true,
      } as any);

      await db.insert(contractors).values({
        id: contractorId,
        userId,
        companyName: "Promo Roofing Co",
        slug: `promo-roof-${crypto.randomUUID()}`,
        phone: "(555) 111-2222",
        email: "owner@promo.test",
        verifiedLicensed: true,
        verifiedInsured: true,
        isActive: true,
      } as any);

      await db.insert(contractorPromos).values({
        contractorId,
        title: "Roof Inspection Promo",
        description: "Seasonal roof package",
        offerDetails: "10% off inspections",
        discountType: "percentage",
        discountValue: "10",
        slug,
        isActive: true,
      } as any);

      const res = await request(app).get(`/promo/${slug}`);
      expect(res.status).toBe(200);
      expect(res.body?.contractor?.phone).toBeUndefined();
      expect(res.body?.contractor?.email).toBeUndefined();
      expect(res.body?.contractor?.contactAccess?.mode).toBe("request_required");
    });

    it("requires request flow before opening marketplace conversation", async () => {
      const sellerId = `seller-${crypto.randomUUID()}`;
      const buyerEmail = `buyer+${crypto.randomUUID()}@tradescout.test`;
      const sellerEmail = `seller+${crypto.randomUUID()}@tradescout.test`;
      const password = `P@ssw0rd-${crypto.randomUUID()}`;
      const categoryId = `cat-${crypto.randomUUID()}`;

      // Seller account + listing seed
      await db.insert(users).values({
        id: sellerId,
        email: sellerEmail,
        password,
        role: "contractor" as any,
        firstName: "Seller",
        lastName: "User",
        emailVerified: true,
        addressVerified: true,
      } as any);

      await db.insert(marketplaceCategories).values({
        id: categoryId,
        name: `Tools-${crypto.randomUUID()}`,
        iconName: "tools",
        isActive: true,
      } as any);

      const [listing] = await db
        .insert(marketplaceListings)
        .values({
          sellerId,
          categoryId,
          title: "Used Compressor",
          slug: `used-compressor-${crypto.randomUUID()}`,
          description: "Runs great",
          price: "400.00",
          county: "Test County",
          state: "TX",
          condition: "good",
          status: "active",
        } as any)
        .returning({ id: marketplaceListings.id });

      const agent = request.agent(app);
      const registerRes = await agent
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send({
          email: buyerEmail,
          password,
          firstName: "Buyer",
          lastName: "User",
          phone: "(555) 333-4444",
          acceptTerms: true,
          userTypes: ["homeowner"],
        });
      expect(registerRes.status).toBe(200);

      const onboardingRes = await agent
        .post("/api/auth/skip-onboarding")
        .set("Content-Type", "application/json")
        .send({ role: "homeowner" });
      expect(onboardingRes.status).toBe(200);

      const decisionScope = `marketplace_listing:${listing.id}`;
      const decisionCardRes = await agent
        .post("/api/decision-cards")
        .set("Content-Type", "application/json")
        .send({
          intent: "collaborate",
          decisionScope,
          title: "Exchange request",
          description: "Review a protected request for this listing.",
        });
      expect(decisionCardRes.status).toBe(200);
      expect(decisionCardRes.body?.id).toBeTruthy();

      const createConversation = await agent
        .post("/api/marketplace/conversations")
        .set("Content-Type", "application/json")
        .send({
          listingId: listing.id,
          initialMessage: "I want to buy this listing.",
          authorityGate: "decision_card",
          sourceDecisionCardId: decisionCardRes.body.id,
          decisionScope,
        });

      expect(createConversation.status).toBe(202);
      expect(createConversation.body?.pending).toBe(true);
      expect(createConversation.body?.created).toBe(false);

      const existing = await db
        .select({ id: marketplaceConversations.id })
        .from(marketplaceConversations)
        .where(eq(marketplaceConversations.listingId, listing.id));
      expect(existing.length).toBe(0);
    });

    it("serves map providers by bbox with awareness-only payload", async () => {
      const userId = `map-user-${crypto.randomUUID()}`;
      const contractorId = `map-contractor-${crypto.randomUUID()}`;
      const tradeId = `trade-${crypto.randomUUID()}`;

      await db.insert(users).values({
        id: userId,
        email: `map+${crypto.randomUUID()}@tradescout.test`,
        firstName: "Map",
        lastName: "Provider",
        role: "contractor" as any,
        countyFips: "48201",
        countyId: "county-48201",
        countyName: "Harris County",
        latitude: "29.7604",
        longitude: "-95.3698",
      } as any);

      await db.insert(contractors).values({
        id: contractorId,
        userId,
        companyName: "Map HVAC Services",
        slug: `map-hvac-${crypto.randomUUID()}`,
        verifiedLicensed: true,
        verifiedInsured: false,
      } as any);

      await db.insert(trades).values({
        id: tradeId,
        name: "HVAC",
        slug: `hvac-${crypto.randomUUID()}`,
      } as any);

      await db.insert(contractorTrades).values({
        contractorId,
        tradeId,
      } as any);

      const bbox = "-95.8,29.4,-95.0,30.1";
      const res = await request(app).get(`/api/map/providers?bbox=${encodeURIComponent(bbox)}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.providers)).toBe(true);
      expect(res.body?.providers.length).toBeGreaterThan(0);

      const provider = res.body.providers.find((item: any) => item.id === userId);
      expect(provider).toBeTruthy();
      expect(typeof provider.lat).toBe("number");
      expect(typeof provider.lng).toBe("number");
      expect(Array.isArray(provider.tradeCategories)).toBe(true);
      expect(provider.phone).toBeUndefined();
      expect(provider.email).toBeUndefined();
    });

    it("transitions unclaimed listing to claimed during signup claim flow", async () => {
      const businessId = `claim-biz-${crypto.randomUUID()}`;
      const claimEmail = `claim+${crypto.randomUUID()}@tradescout.test`;
      const password = `P@ssw0rd-${crypto.randomUUID()}`;

      await db.insert(businesses).values({
        id: businessId,
        name: `Claimable Biz ${crypto.randomUUID().slice(0, 8)}`,
        slug: `claimable-biz-${crypto.randomUUID().slice(0, 8)}`,
        type: "other" as any,
        roleContext: "business_owner" as any,
        ownerUserId: null,
        claimStatus: "unclaimed",
        sources: ["test_seed"],
        status: "draft" as any,
        profileData: {
          email: claimEmail,
          phone: "(555) 888-9999",
        },
      } as any);

      const agent = request.agent(app);
      const registerRes = await agent
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send({
          email: claimEmail,
          password,
          firstName: "Claim",
          lastName: "Owner",
          phone: "(555) 888-9999",
          acceptTerms: true,
          userTypes: ["business_owner"],
          claimBusinessId: businessId,
        });

      expect(registerRes.status).toBe(200);
      expect(registerRes.body?.claim?.status).toBe("claimed");

      const rows = await db
        .select({
          ownerUserId: businesses.ownerUserId,
          claimStatus: businesses.claimStatus,
        })
        .from(businesses)
        .where(eq(businesses.id, businessId))
        .limit(1);

      expect(rows[0]?.ownerUserId).toBeTruthy();
      expect(rows[0]?.claimStatus).toBe("claimed");
    });
  });
}
