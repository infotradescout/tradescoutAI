import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../db";
import {
  contractorCounties,
  contractors,
  contractorTrades,
  counties,
  tradeRequirements,
  trades,
  workRequestAssignments,
  workRequests,
} from "@shared/schema";
import { createAuthedAgent, createUserOnly } from "./helpers/testAuth";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeWithDb("direct-connect gate integration (no mocks)", () => {
  it("returns 428 and does not create a work request when homeowner is unverified", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "homeowner",
      addressVerified: false,
      emailVerified: true,
      onboardingCompleted: true,
    });

    const title = `Gate block ${Date.now()}`;

    const res = await agent.post("/api/direct-connect/requests").send({
      title,
      description: "Need help with roof leak near chimney flashing.",
      category: "service_request",
    });

    expect(res.status).toBe(428);
    expect(res.body?.code).toBe("VERIFICATION_REQUIRED");

    const inserted = await db
      .select()
      .from(workRequests)
      .where(and(eq(workRequests.createdByUserId, String(user.id)), eq(workRequests.title, title)));

    expect(inserted).toHaveLength(0);
  });

  it("allows unverified homeowner request creation when direct-connect demo bypass is enabled", async () => {
    const previous = process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED;
    process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED = "true";

    try {
      const { agent, user } = await createAuthedAgent({
        role: "homeowner",
        addressVerified: false,
        emailVerified: true,
        onboardingCompleted: true,
      });

      const title = `Gate bypass ${Date.now()}`;

      const res = await agent.post("/api/direct-connect/requests").send({
        title,
        description: "Need help replacing a bathroom vanity and faucet.",
        category: "service_request",
      });

      expect(res.status).toBe(201);

      const inserted = await db
        .select()
        .from(workRequests)
        .where(
          and(eq(workRequests.createdByUserId, String(user.id)), eq(workRequests.title, title))
        );

      expect(inserted).toHaveLength(1);
    } finally {
      if (typeof previous === "undefined") {
        delete process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED;
      } else {
        process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED = previous;
      }
    }
  });

  it("fails closed when trade requires verification and none of the candidate contractors qualify", async () => {
    const { agent, user: requester } = await createAuthedAgent({
      role: "homeowner",
      addressVerified: true,
      emailVerified: true,
      onboardingCompleted: true,
    });

    const [county] = await db.select().from(counties).limit(1);
    expect(county).toBeTruthy();

    const unique = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
    const tradeSlug = `gate-test-trade-${unique}`;
    const [trade] = await db
      .insert(trades)
      .values({
        name: `Gate Test Trade ${unique}`,
        slug: tradeSlug,
      } as any)
      .returning();
    expect(trade).toBeTruthy();

    await db.insert(tradeRequirements).values({
      tradeId: trade.id,
      requiresLicense: true,
      requiresInsurance: false,
      requiresEin: false,
      notes: "Integration test gate",
    } as any);

    const contractorUserA = await createUserOnly({
      role: "contractor",
      emailVerified: true,
      addressVerified: true,
      onboardingCompleted: true,
    });
    const contractorUserB = await createUserOnly({
      role: "contractor",
      emailVerified: true,
      addressVerified: true,
      onboardingCompleted: true,
    });

    const [contractorA] = await db
      .insert(contractors)
      .values({
        userId: contractorUserA.id,
        companyName: `NoLicense A ${unique}`,
        slug: `no-license-a-${unique}`,
        isActive: true,
      } as any)
      .returning();
    const [contractorB] = await db
      .insert(contractors)
      .values({
        userId: contractorUserB.id,
        companyName: `NoLicense B ${unique}`,
        slug: `no-license-b-${unique}`,
        isActive: true,
      } as any)
      .returning();

    await db
      .insert(contractorTrades)
      .values([
        { contractorId: contractorA.id, tradeId: trade.id } as any,
        { contractorId: contractorB.id, tradeId: trade.id } as any,
      ]);

    await db
      .insert(contractorCounties)
      .values([
        { contractorId: contractorA.id, countyId: county.id } as any,
        { contractorId: contractorB.id, countyId: county.id } as any,
      ]);

    const [requestRow] = await db
      .insert(workRequests)
      .values({
        createdByUserId: requester.id,
        title: `Route gate ${unique}`,
        description: "Route should fail closed.",
        category: "service_request",
        tradeId: trade.slug,
        countyFips: county.fips,
        stateCode: county.stateCode,
        source: "direct_connect" as any,
        scope: "community",
        status: "open",
        visibility: "community",
        exposureMode: "guided",
        competitionMode: "none",
      } as any)
      .returning();

    const res = await agent.post(`/api/direct-connect/requests/${requestRow.id}/route`).send({});

    expect(res.status).toBe(200);
    expect(res.body?.routed).toBe(false);
    expect(Array.isArray(res.body?.assignments)).toBe(true);
    expect(res.body.assignments).toHaveLength(0);

    const assignments = await db
      .select()
      .from(workRequestAssignments)
      .where(eq(workRequestAssignments.workRequestId, requestRow.id));
    expect(assignments).toHaveLength(0);
  });

  it("routes requests even when trade has verification requirements if demo bypass is enabled", async () => {
    const previous = process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED;
    process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED = "true";

    try {
      const { agent, user: requester } = await createAuthedAgent({
        role: "homeowner",
        addressVerified: false,
        emailVerified: true,
        onboardingCompleted: true,
      });

      const [county] = await db.select().from(counties).limit(1);
      expect(county).toBeTruthy();

      const unique = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
      const tradeSlug = `gate-bypass-trade-${unique}`;
      const [trade] = await db
        .insert(trades)
        .values({
          name: `Gate Bypass Trade ${unique}`,
          slug: tradeSlug,
        } as any)
        .returning();
      expect(trade).toBeTruthy();

      await db.insert(tradeRequirements).values({
        tradeId: trade.id,
        requiresLicense: true,
        requiresInsurance: true,
        requiresEin: true,
        notes: "Integration bypass gate",
      } as any);

      const contractorUserA = await createUserOnly({
        role: "contractor",
        emailVerified: true,
        addressVerified: false,
        onboardingCompleted: true,
      });
      const contractorUserB = await createUserOnly({
        role: "contractor",
        emailVerified: true,
        addressVerified: false,
        onboardingCompleted: true,
      });

      const [contractorA] = await db
        .insert(contractors)
        .values({
          userId: contractorUserA.id,
          companyName: `Bypass A ${unique}`,
          slug: `bypass-a-${unique}`,
          isActive: true,
        } as any)
        .returning();
      const [contractorB] = await db
        .insert(contractors)
        .values({
          userId: contractorUserB.id,
          companyName: `Bypass B ${unique}`,
          slug: `bypass-b-${unique}`,
          isActive: true,
        } as any)
        .returning();

      await db
        .insert(contractorTrades)
        .values([
          { contractorId: contractorA.id, tradeId: trade.id } as any,
          { contractorId: contractorB.id, tradeId: trade.id } as any,
        ]);

      await db
        .insert(contractorCounties)
        .values([
          { contractorId: contractorA.id, countyId: county.id } as any,
          { contractorId: contractorB.id, countyId: county.id } as any,
        ]);

      const [requestRow] = await db
        .insert(workRequests)
        .values({
          createdByUserId: requester.id,
          title: `Route bypass ${unique}`,
          description: "Route should bypass verification gates in demo mode.",
          category: "service_request",
          tradeId: trade.slug,
          countyFips: county.fips,
          stateCode: county.stateCode,
          source: "direct_connect" as any,
          scope: "community",
          status: "open",
          visibility: "community",
          exposureMode: "guided",
          competitionMode: "none",
        } as any)
        .returning();

      const res = await agent.post(`/api/direct-connect/requests/${requestRow.id}/route`).send({});

      expect(res.status).toBe(200);
      expect(res.body?.routed).toBe(true);
      expect(Array.isArray(res.body?.assignments)).toBe(true);
      expect(res.body.assignments.length).toBeGreaterThan(0);

      const assignments = await db
        .select()
        .from(workRequestAssignments)
        .where(eq(workRequestAssignments.workRequestId, requestRow.id));
      expect(assignments.length).toBeGreaterThan(0);
    } finally {
      if (typeof previous === "undefined") {
        delete process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED;
      } else {
        process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED = previous;
      }
    }
  });

  it("lists only direct_connect requests for the authenticated requester", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "homeowner",
      addressVerified: true,
      emailVerified: true,
      onboardingCompleted: true,
    });

    const unique = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

    const [dcRequest] = await db
      .insert(workRequests)
      .values({
        createdByUserId: user.id,
        title: `DC scoped ${unique}`,
        description: "Should appear in /api/direct-connect/requests.",
        category: "service_request",
        source: "direct_connect" as any,
        scope: "community",
        status: "open",
        visibility: "community",
        exposureMode: "guided",
        competitionMode: "none",
      } as any)
      .returning();

    await db.insert(workRequests).values({
      createdByUserId: user.id,
      title: `Non-DC ${unique}`,
      description: "Should NOT appear in /api/direct-connect/requests.",
      category: "service_request",
      source: "tasks" as any,
      scope: "community",
      status: "open",
      visibility: "community",
      exposureMode: "guided",
      competitionMode: "none",
    } as any);

    const res = await agent.get("/api/direct-connect/requests");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const ids = (res.body as any[]).map((row) => String(row.id));
    expect(ids).toContain(String(dcRequest.id));
    expect(res.body.every((row: any) => String(row.source || "") === "direct_connect")).toBe(true);
  });

  it("persists request attachments and scopes attachment access to the requester or assigned contractor", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "homeowner",
      addressVerified: true,
      emailVerified: true,
      onboardingCompleted: true,
    });

    const { agent: assignedContractorAgent, user: assignedContractorUser } =
      await createAuthedAgent({
        role: "contractor",
        addressVerified: true,
        emailVerified: true,
        onboardingCompleted: true,
      });
    const { agent: unrelatedAgent } = await createAuthedAgent({
      role: "homeowner",
      addressVerified: true,
      emailVerified: true,
      onboardingCompleted: true,
    });

    const unique = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
    const [assignedContractor] = await db
      .insert(contractors)
      .values({
        userId: assignedContractorUser.id,
        companyName: `Attachment Access ${unique}`,
        slug: `attachment-access-${unique}`,
        isActive: true,
      } as any)
      .returning();

    const createRes = await agent.post("/api/direct-connect/requests").send({
      title: `Attachment request ${unique}`,
      description: "Need help with a project and attached photos.",
      category: "service_request",
      attachments: [
        " https://example.com/request-photo.jpg ",
        "https://example.com/request-photo.jpg",
      ],
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body?.id).toBeTruthy();

    const requestId = String(createRes.body.id);

    const [storedRequest] = await db
      .select()
      .from(workRequests)
      .where(
        and(eq(workRequests.id, requestId), eq(workRequests.createdByUserId, String(user.id)))
      );

    expect(storedRequest).toBeTruthy();
    expect((storedRequest as any).attachments).toEqual(["https://example.com/request-photo.jpg"]);

    const listRes = await agent.get("/api/direct-connect/requests");
    expect(listRes.status).toBe(200);
    const listed = (listRes.body as any[]).find((row) => String(row.id) === requestId);
    expect(listed).toBeTruthy();
    expect(listed.attachmentCount).toBe(1);

    await db.insert(workRequestAssignments).values({
      workRequestId: requestId,
      contractorId: assignedContractor.id,
      status: "suggested",
    } as any);

    const ownerAttachmentRes = await agent.get(
      `/api/direct-connect/requests/${requestId}/attachments/0`
    );
    expect(ownerAttachmentRes.status).toBe(302);
    expect(ownerAttachmentRes.headers.location).toBe("https://example.com/request-photo.jpg");

    const assignedAttachmentRes = await assignedContractorAgent.get(
      `/api/direct-connect/requests/${requestId}/attachments/0`
    );
    expect(assignedAttachmentRes.status).toBe(302);
    expect(assignedAttachmentRes.headers.location).toBe("https://example.com/request-photo.jpg");

    const unrelatedAttachmentRes = await unrelatedAgent.get(
      `/api/direct-connect/requests/${requestId}/attachments/0`
    );
    expect(unrelatedAttachmentRes.status).toBe(403);
    expect(unrelatedAttachmentRes.body?.message).toContain("do not have access");
  });
});
