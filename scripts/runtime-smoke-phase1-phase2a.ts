import request from "supertest";
import { eq, and } from "drizzle-orm";
import { createApp } from "../server/app";
import { hashPassword } from "../server/auth";
import { db, pool } from "../server/db";
import {
  users,
  counties,
  marketplaceCategories,
  marketplaceListings,
  homeScoutListings,
  contractors,
  conversations,
  workRequestAssignments,
  userHomes,
} from "../shared/schema";

type SmokeUserSeed = {
  email: string;
  password: string;
  role?: string;
  emailVerified?: boolean;
  addressVerified?: boolean;
  verificationStatus?: "pending" | "in_review" | "approved" | "rejected";
};

type SmokeUser = {
  id: string;
  email: string;
  password: string;
};

type AssertionResult = {
  name: string;
  ok: boolean;
  details?: string;
};

const RUN_ID = Date.now().toString();
const MARKER = `[smoke-${RUN_ID}]`;

async function upsertUser(seed: SmokeUserSeed): Promise<SmokeUser> {
  const existing = await db.select().from(users).where(eq(users.email, seed.email)).limit(1);
  const passwordHash = await hashPassword(seed.password);

  if (existing[0]) {
    const [updated] = await db
      .update(users)
      .set({
        password: passwordHash,
        role: (seed.role as any) || "homeowner",
        roles: [((seed.role as any) || "homeowner") as any],
        activeRole: (seed.role as any) || "homeowner",
        emailVerified: seed.emailVerified === true,
        addressVerified: seed.addressVerified === true,
        verificationStatus: (seed.verificationStatus || "pending") as any,
        profileVersion: 999,
        firstName: "Smoke",
        lastName: "User",
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, existing[0].id))
      .returning();

    return {
      id: String(updated.id),
      email: String(updated.email),
      password: seed.password,
    };
  }

  const [created] = await db
    .insert(users)
    .values({
      email: seed.email,
      password: passwordHash,
      role: (seed.role as any) || "homeowner",
      roles: [((seed.role as any) || "homeowner") as any],
      activeRole: (seed.role as any) || "homeowner",
      emailVerified: seed.emailVerified === true,
      addressVerified: seed.addressVerified === true,
      verificationStatus: (seed.verificationStatus || "pending") as any,
      profileVersion: 999,
      firstName: "Smoke",
      lastName: "User",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning();

  return {
    id: String(created.id),
    email: String(created.email),
    password: seed.password,
  };
}

function pushResult(results: AssertionResult[], name: string, ok: boolean, details?: string) {
  results.push({ name, ok, details });
  const status = ok ? "PASS" : "FAIL";
  console.log(`${MARKER} ${status} ${name}${details ? ` :: ${details}` : ""}`);
}

function summarizeIds(rows: any[]): string {
  return rows
    .map((row) => String(row?.id || ""))
    .filter(Boolean)
    .join(",");
}

async function insertLifecycleWorkRequest(input: {
  createdByUserId: string;
  title: string;
  description: string;
  category: string;
  countyFips: string;
  stateCode: string;
}) {
  const result = await pool.query(
    `
      insert into work_requests (
        created_by_user_id,
        title,
        description,
        category,
        county_fips,
        state_code,
        scope,
        source,
        status,
        visibility,
        exposure_mode,
        competition_mode,
        created_at,
        updated_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'community',
        'direct_connect',
        'routed',
        'community',
        'guided',
        'none',
        now(),
        now()
      )
      returning id
    `,
    [
      input.createdByUserId,
      input.title,
      input.description,
      input.category,
      input.countyFips,
      input.stateCode,
    ]
  );

  return { id: String(result.rows[0].id) };
}

async function loginAgent(app: any, email: string, password: string) {
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").send({ email, password });
  if (login.status !== 200) {
    throw new Error(
      `Login failed for ${email}: ${login.status} ${JSON.stringify(login.body || {})}`
    );
  }
  return agent;
}

async function main() {
  const results: AssertionResult[] = [];
  const { app, server } = await createApp();

  try {
    const [county] = await db
      .select({ fips: counties.fips, stateCode: counties.stateCode, name: counties.name })
      .from(counties)
      .limit(1);

    if (!county) {
      throw new Error("No counties found; cannot run runtime smoke checks.");
    }

    const authorizedSeller = await upsertUser({
      email: `smoke.auth.seller.${RUN_ID}@example.com`,
      password: "SmokePass123!",
      role: "homeowner",
      emailVerified: true,
      addressVerified: true,
      verificationStatus: "approved",
    });

    const unauthorizedSeller = await upsertUser({
      email: `smoke.unauth.seller.${RUN_ID}@example.com`,
      password: "SmokePass123!",
      role: "homeowner",
      emailVerified: false,
      addressVerified: false,
      verificationStatus: "pending",
    });

    const ownerUser = await upsertUser({
      email: `smoke.owner.${RUN_ID}@example.com`,
      password: "SmokePass123!",
      role: "homeowner",
      emailVerified: true,
      addressVerified: true,
      verificationStatus: "approved",
    });

    const adminUser = await upsertUser({
      email: `smoke.admin.${RUN_ID}@example.com`,
      password: "SmokePass123!",
      role: "super_admin",
      emailVerified: true,
      addressVerified: true,
      verificationStatus: "approved",
    });

    const homeownerLifecycle = await upsertUser({
      email: `smoke.home.lifecycle.${RUN_ID}@example.com`,
      password: "SmokePass123!",
      role: "homeowner",
      emailVerified: true,
      addressVerified: true,
      verificationStatus: "approved",
    });

    const homeownerNoLifecycle = await upsertUser({
      email: `smoke.home.nolifecycle.${RUN_ID}@example.com`,
      password: "SmokePass123!",
      role: "homeowner",
      emailVerified: true,
      addressVerified: true,
      verificationStatus: "approved",
    });

    const contractorActorLifecycle = await upsertUser({
      email: `smoke.contractor.lifecycle.${RUN_ID}@example.com`,
      password: "SmokePass123!",
      role: "homeowner",
      emailVerified: true,
      addressVerified: true,
      verificationStatus: "approved",
    });

    const contractorActorNoLifecycle = await upsertUser({
      email: `smoke.contractor.nolifecycle.${RUN_ID}@example.com`,
      password: "SmokePass123!",
      role: "homeowner",
      emailVerified: true,
      addressVerified: true,
      verificationStatus: "approved",
    });

    const outsiderUser = await upsertUser({
      email: `smoke.outsider.${RUN_ID}@example.com`,
      password: "SmokePass123!",
      role: "homeowner",
      emailVerified: true,
      addressVerified: true,
      verificationStatus: "approved",
    });

    const [category] = await db
      .insert(marketplaceCategories)
      .values({
        name: `SmokeCategory-${RUN_ID}`,
        description: "Runtime smoke category",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const [marketAuthorized] = await db
      .insert(marketplaceListings)
      .values({
        sellerId: authorizedSeller.id,
        categoryId: String(category.id),
        title: `Smoke Market Authorized ${RUN_ID}`,
        description: "Authorized seller listing",
        price: "123.00",
        county: String(county.fips),
        state: String(county.stateCode),
        condition: "good",
        status: "active",
        slug: `smoke-market-authorized-${RUN_ID}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const [marketUnauthorized] = await db
      .insert(marketplaceListings)
      .values({
        sellerId: unauthorizedSeller.id,
        categoryId: String(category.id),
        title: `Smoke Market Unauthorized ${RUN_ID}`,
        description: "Unauthorized seller listing",
        price: "456.00",
        county: String(county.fips),
        state: String(county.stateCode),
        condition: "good",
        status: "active",
        slug: `smoke-market-unauthorized-${RUN_ID}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const [homeAuthorized] = await db
      .insert(homeScoutListings)
      .values({
        sourceKey: "manual",
        sourceListingId: `smoke-home-authorized-${RUN_ID}`,
        status: "active",
        title: `Smoke Home Authorized ${RUN_ID}`,
        description: "Authorized exposure listing",
        price: "350000.00",
        countyFips: String(county.fips),
        stateCode: String(county.stateCode),
        city: "Smoke City",
        addressVisibility: "approximate",
        contactUserId: authorizedSeller.id,
        sellerUserId: authorizedSeller.id,
        listingAuthorType: "owner",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const [homeUnauthorized] = await db
      .insert(homeScoutListings)
      .values({
        sourceKey: "manual",
        sourceListingId: `smoke-home-unauthorized-${RUN_ID}`,
        status: "active",
        title: `Smoke Home Unauthorized ${RUN_ID}`,
        description: "Unauthorized exposure listing",
        price: "360000.00",
        countyFips: String(county.fips),
        stateCode: String(county.stateCode),
        city: "Smoke City",
        addressVisibility: "approximate",
        contactUserId: unauthorizedSeller.id,
        sellerUserId: unauthorizedSeller.id,
        listingAuthorType: "owner",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const [homeInactiveOwner] = await db
      .insert(homeScoutListings)
      .values({
        sourceKey: "manual",
        sourceListingId: `smoke-home-inactive-${RUN_ID}`,
        status: "removed",
        title: `Smoke Home Inactive ${RUN_ID}`,
        description: "Inactive listing for owner/admin exception checks",
        price: "370000.00",
        countyFips: String(county.fips),
        stateCode: String(county.stateCode),
        city: "Smoke City",
        addressVisibility: "approximate",
        contactUserId: ownerUser.id,
        sellerUserId: ownerUser.id,
        listingAuthorType: "owner",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const [contractorLifecycle] = await db
      .insert(contractors)
      .values({
        userId: contractorActorLifecycle.id,
        companyName: `Smoke Contractor Lifecycle ${RUN_ID}`,
        slug: `smoke-contractor-lifecycle-${RUN_ID}`,
        email: contractorActorLifecycle.email,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const [contractorNoLifecycle] = await db
      .insert(contractors)
      .values({
        userId: contractorActorNoLifecycle.id,
        companyName: `Smoke Contractor NoLifecycle ${RUN_ID}`,
        slug: `smoke-contractor-nolifecycle-${RUN_ID}`,
        email: contractorActorNoLifecycle.email,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const [conversationLifecycle] = await db
      .insert(conversations)
      .values({
        homeownerId: homeownerLifecycle.id,
        contractorId: String(contractorLifecycle.id),
        status: "active",
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const [conversationNoLifecycle] = await db
      .insert(conversations)
      .values({
        homeownerId: homeownerNoLifecycle.id,
        contractorId: String(contractorNoLifecycle.id),
        status: "active",
        lastMessageAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const workRequestLifecycle = await insertLifecycleWorkRequest({
      createdByUserId: homeownerLifecycle.id,
      title: `Smoke Work Request ${RUN_ID}`,
      description: "Lifecycle-authorized work request",
      category: "service_request",
      countyFips: String(county.fips),
      stateCode: String(county.stateCode),
    });

    await db.insert(workRequestAssignments).values({
      workRequestId: String(workRequestLifecycle.id),
      contractorId: String(contractorLifecycle.id),
      status: "accepted",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const [homeForShare] = await db
      .insert(userHomes)
      .values({
        ownerUserId: homeownerLifecycle.id,
        nickname: `Smoke Home ${RUN_ID}`,
        city: "Smoke City",
        stateCode: String(county.stateCode),
        countyFips: String(county.fips),
        zipCode: "00000",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();

    const ownerAgent = await loginAgent(app, ownerUser.email, ownerUser.password);
    const adminAgent = await loginAgent(app, adminUser.email, adminUser.password);
    const lifecycleHomeownerAgent = await loginAgent(
      app,
      homeownerLifecycle.email,
      homeownerLifecycle.password
    );
    const noLifecycleHomeownerAgent = await loginAgent(
      app,
      homeownerNoLifecycle.email,
      homeownerNoLifecycle.password
    );
    const outsiderAgent = await loginAgent(app, outsiderUser.email, outsiderUser.password);

    const searchRes = await request(app)
      .get(
        `/api/homescout/search?countyFips=${county.fips}&stateCode=${county.stateCode}&query=${encodeURIComponent(RUN_ID)}`
      )
      .send();
    const searchIds = Array.isArray(searchRes.body)
      ? searchRes.body.map((row: any) => String(row?.id || ""))
      : [];
    pushResult(
      results,
      "homescout search filters unauthorized listings",
      searchRes.status === 200 &&
        searchIds.includes(String(homeAuthorized.id)) &&
        !searchIds.includes(String(homeUnauthorized.id)),
      `status=${searchRes.status} ids=${summarizeIds(Array.isArray(searchRes.body) ? searchRes.body : [])}`
    );

    const countySearchRes = await request(app)
      .get(`/api/homescout/search/county?fips=${county.fips}&stateCode=${county.stateCode}`)
      .send();
    const countySearchIds = Array.isArray(countySearchRes.body)
      ? countySearchRes.body.map((row: any) => String(row?.id || ""))
      : [];
    pushResult(
      results,
      "homescout county search filters unauthorized listings",
      countySearchRes.status === 200 &&
        countySearchIds.includes(String(homeAuthorized.id)) &&
        !countySearchIds.includes(String(homeUnauthorized.id)),
      `status=${countySearchRes.status}`
    );

    const unauthorizedDetailRes = await request(app)
      .get(`/api/homescout/listings/${homeUnauthorized.id}`)
      .send();
    pushResult(
      results,
      "homescout detail fails closed for unauthorized public listing",
      unauthorizedDetailRes.status === 404,
      `status=${unauthorizedDetailRes.status}`
    );

    const publicInactiveRes = await request(app)
      .get(`/api/homescout/listings/${homeInactiveOwner.id}`)
      .send();
    pushResult(
      results,
      "homescout inactive listing hidden from public",
      publicInactiveRes.status === 404,
      `status=${publicInactiveRes.status}`
    );

    const ownerInactiveRes = await ownerAgent.get(
      `/api/homescout/listings/${homeInactiveOwner.id}`
    );
    pushResult(
      results,
      "homescout owner exception for inactive listing",
      ownerInactiveRes.status === 200,
      `status=${ownerInactiveRes.status}`
    );

    const adminInactiveRes = await adminAgent.get(
      `/api/homescout/listings/${homeInactiveOwner.id}`
    );
    pushResult(
      results,
      "homescout admin exception for inactive listing",
      adminInactiveRes.status === 200,
      `status=${adminInactiveRes.status}`
    );

    const publicDetailRes = await request(app)
      .get(`/api/homescout/listings/${homeAuthorized.id}`)
      .send();
    const detailListing = publicDetailRes.body?.listing || {};
    const leakedIdentityFields =
      Object.prototype.hasOwnProperty.call(detailListing, "contactUserId") ||
      Object.prototype.hasOwnProperty.call(detailListing, "sellerUserId") ||
      Object.prototype.hasOwnProperty.call(detailListing, "agentUserId");
    pushResult(
      results,
      "homescout public detail has no identity pivot fields",
      publicDetailRes.status === 200 && !leakedIdentityFields,
      `status=${publicDetailRes.status}`
    );

    const marketListRes = await request(app)
      .get(`/api/marketplace/listings?search=${encodeURIComponent(RUN_ID)}`)
      .send();
    const marketListIds = Array.isArray(marketListRes.body)
      ? marketListRes.body.map((row: any) => String(row?.id || ""))
      : [];
    pushResult(
      results,
      "marketplace listings filter unauthorized sellers",
      marketListRes.status === 200 &&
        marketListIds.includes(String(marketAuthorized.id)) &&
        !marketListIds.includes(String(marketUnauthorized.id)),
      `status=${marketListRes.status} ids=${summarizeIds(Array.isArray(marketListRes.body) ? marketListRes.body : [])}`
    );

    const marketSearchRes = await request(app)
      .get(`/api/marketplace/search?query=${encodeURIComponent(RUN_ID)}`)
      .send();
    const marketSearchIds = Array.isArray(marketSearchRes.body)
      ? marketSearchRes.body.map((row: any) => String(row?.id || ""))
      : [];
    pushResult(
      results,
      "marketplace search filters unauthorized sellers",
      marketSearchRes.status === 200 &&
        marketSearchIds.includes(String(marketAuthorized.id)) &&
        !marketSearchIds.includes(String(marketUnauthorized.id)),
      `status=${marketSearchRes.status} ids=${summarizeIds(Array.isArray(marketSearchRes.body) ? marketSearchRes.body : [])}`
    );

    const outsiderConvRes = await outsiderAgent.get(
      `/api/conversations/${conversationLifecycle.id}`
    );
    pushResult(
      results,
      "conversation denies authenticated non-participant",
      outsiderConvRes.status === 403,
      `status=${outsiderConvRes.status}`
    );

    const noLifecycleConvRes = await noLifecycleHomeownerAgent.get(
      `/api/conversations/${conversationNoLifecycle.id}`
    );
    pushResult(
      results,
      "conversation denies participant without lifecycle authority",
      noLifecycleConvRes.status === 403 &&
        String(noLifecycleConvRes.body?.reasonCode || "") === "CONNECTION_AUTHORITY_REQUIRED",
      `status=${noLifecycleConvRes.status}`
    );

    const lifecycleConvRes = await lifecycleHomeownerAgent.get(
      `/api/conversations/${conversationLifecycle.id}`
    );
    pushResult(
      results,
      "conversation allows participant with lifecycle authority",
      lifecycleConvRes.status === 200,
      `status=${lifecycleConvRes.status}`
    );

    const noLifecycleMessagesPostRes = await noLifecycleHomeownerAgent
      .post(`/api/messages/threads/${conversationNoLifecycle.id}/messages`)
      .send({ content: "Smoke no lifecycle", messageType: "text" });
    pushResult(
      results,
      "thread message post denies participant without lifecycle authority",
      noLifecycleMessagesPostRes.status === 403 &&
        String(noLifecycleMessagesPostRes.body?.reasonCode || "") ===
          "CONNECTION_AUTHORITY_REQUIRED",
      `status=${noLifecycleMessagesPostRes.status}`
    );

    const lifecycleMessagesPostRes = await lifecycleHomeownerAgent
      .post(`/api/messages/threads/${conversationLifecycle.id}/messages`)
      .send({ content: `Smoke lifecycle ${RUN_ID}`, messageType: "text" });
    pushResult(
      results,
      "thread message post allows participant with lifecycle authority",
      lifecycleMessagesPostRes.status === 200,
      `status=${lifecycleMessagesPostRes.status}`
    );

    const noLifecycleShareRes = await noLifecycleHomeownerAgent
      .post(`/api/messages/threads/${conversationNoLifecycle.id}/home-report/share`)
      .send({ homeId: String(homeForShare.id), includeAddress: false, includeDocuments: false });
    pushResult(
      results,
      "home report share denies participant without lifecycle authority",
      noLifecycleShareRes.status === 403 &&
        String(noLifecycleShareRes.body?.reasonCode || "") === "CONNECTION_AUTHORITY_REQUIRED",
      `status=${noLifecycleShareRes.status}`
    );

    const lifecycleShareRes = await lifecycleHomeownerAgent
      .post(`/api/messages/threads/${conversationLifecycle.id}/home-report/share`)
      .send({ homeId: String(homeForShare.id), includeAddress: false, includeDocuments: false });
    pushResult(
      results,
      "home report share allows participant with lifecycle authority",
      lifecycleShareRes.status === 201,
      `status=${lifecycleShareRes.status}`
    );

    const lifecycleConvMessagesRes = await lifecycleHomeownerAgent.get(
      `/api/conversations/${conversationLifecycle.id}/messages`
    );
    pushResult(
      results,
      "conversation messages allow participant with lifecycle authority",
      lifecycleConvMessagesRes.status === 200,
      `status=${lifecycleConvMessagesRes.status}`
    );

    const lifecycleQuotesRes = await lifecycleHomeownerAgent.get(
      `/api/conversations/${conversationLifecycle.id}/quotes`
    );
    pushResult(
      results,
      "conversation quotes allow participant with lifecycle authority",
      lifecycleQuotesRes.status === 200,
      `status=${lifecycleQuotesRes.status}`
    );

    const lifecycleMaterialsRes = await lifecycleHomeownerAgent.get(
      `/api/conversations/${conversationLifecycle.id}/material-lists`
    );
    pushResult(
      results,
      "conversation material lists allow participant with lifecycle authority",
      lifecycleMaterialsRes.status === 200,
      `status=${lifecycleMaterialsRes.status}`
    );

    const failed = results.filter((result) => !result.ok);
    const passed = results.length - failed.length;

    console.log(
      `${MARKER} SUMMARY passed=${passed} failed=${failed.length} total=${results.length}`
    );
    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    server?.close?.();
  }
}

main().catch((error) => {
  console.error(`${MARKER} FATAL`, error);
  process.exit(1);
});
