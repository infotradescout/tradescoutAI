import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../db";
import { clearAdminAuditLog, getAdminAuditLog } from "../services/adminAuditLogService";
import {
  users,
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
  it("creates non-targeted direct connect requests as live (routed) on submit", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "homeowner",
      addressVerified: true,
      emailVerified: true,
      onboardingCompleted: true,
    });

    const title = `Direct Connect live ${Date.now()}`;

    const res = await agent.post("/api/direct-connect/requests").send({
      title,
      description: "Need a pro to inspect and repair a leaking outdoor faucet.",
      category: "service_request",
    });

    expect(res.status).toBe(201);
    expect(String(res.body?.status || "")).toBe("routed");

    const requestId = String(res.body?.id || "");
    expect(requestId.length).toBeGreaterThan(0);

    const inserted = await db
      .select()
      .from(workRequests)
      .where(
        and(eq(workRequests.id, requestId), eq(workRequests.createdByUserId, String(user.id)))
      );

    expect(inserted).toHaveLength(1);
    expect(String(inserted[0]?.status || "")).toBe("routed");
    expect(String(inserted[0]?.source || "")).toBe("direct_connect");
  });

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
    await clearAdminAuditLog();

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
      const createdId = String(res.body?.id || "");
      expect(createdId.length).toBeGreaterThan(0);
      expect(String(res.body?.status || "")).toBe("routed");

      const inserted = await db
        .select()
        .from(workRequests)
        .where(
          and(eq(workRequests.id, createdId), eq(workRequests.createdByUserId, String(user.id)))
        );

      expect(inserted).toHaveLength(1);

      const auditLog = await getAdminAuditLog(20);
      const bypassAudit = auditLog.find(
        (entry: any) =>
          entry?.action === "direct_connect_verification_bypass_applied" &&
          entry?.operation === "create" &&
          String(entry?.actorUserId || "") === String(user.id)
      );
      expect(bypassAudit).toBeTruthy();
      expect(String((bypassAudit as any)?.bypassReason || "")).toBe("direct_connect_demo_mode");
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

  it("lists only current local community requests on the direct-connect board endpoint", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "homeowner",
      addressVerified: true,
      emailVerified: true,
      onboardingCompleted: true,
    });

    const countyRows = await db.select().from(counties).limit(2);
    expect(countyRows.length).toBeGreaterThan(0);

    const localCounty = countyRows[0] as any;
    const otherCounty = (countyRows[1] as any) ?? {
      fips: "99999",
      stateCode: String(localCounty.stateCode || "TX"),
    };

    await db
      .update(users)
      .set({
        countyFips: String(localCounty.fips),
        stateCode: String(localCounty.stateCode || "").toUpperCase(),
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, String(user.id)));

    const unique = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
    const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const inserted = await db
      .insert(workRequests)
      .values([
        {
          createdByUserId: user.id,
          title: `Board local open ${unique}`,
          description: "Should be visible on local board.",
          category: "service_request",
          countyFips: localCounty.fips,
          stateCode: localCounty.stateCode,
          source: "direct_connect" as any,
          scope: "community",
          status: "open",
          visibility: "community",
          exposureMode: "guided",
          competitionMode: "none",
        } as any,
        {
          createdByUserId: user.id,
          title: `Board local routed ${unique}`,
          description: "Should be visible on local board.",
          category: "service_request",
          countyFips: localCounty.fips,
          stateCode: localCounty.stateCode,
          source: "direct_connect" as any,
          scope: "community",
          status: "routed",
          visibility: "community",
          exposureMode: "guided",
          competitionMode: "none",
        } as any,
        {
          createdByUserId: user.id,
          title: `Board local cancelled ${unique}`,
          description: "Should not be visible because cancelled.",
          category: "service_request",
          countyFips: localCounty.fips,
          stateCode: localCounty.stateCode,
          source: "direct_connect" as any,
          scope: "community",
          status: "cancelled",
          visibility: "community",
          exposureMode: "guided",
          competitionMode: "none",
        } as any,
        {
          createdByUserId: user.id,
          title: `Board local private ${unique}`,
          description: "Should not be visible because private.",
          category: "service_request",
          countyFips: localCounty.fips,
          stateCode: localCounty.stateCode,
          source: "direct_connect" as any,
          scope: "personal",
          status: "open",
          visibility: "private",
          exposureMode: "guided",
          competitionMode: "none",
        } as any,
        {
          createdByUserId: user.id,
          title: `Board other county ${unique}`,
          description: "Should not be visible because out-of-county.",
          category: "service_request",
          countyFips: otherCounty.fips,
          stateCode: otherCounty.stateCode,
          source: "direct_connect" as any,
          scope: "community",
          status: "open",
          visibility: "community",
          exposureMode: "guided",
          competitionMode: "none",
        } as any,
        {
          createdByUserId: user.id,
          title: `Board stale local ${unique}`,
          description: "Should not be visible because stale.",
          category: "service_request",
          countyFips: localCounty.fips,
          stateCode: localCounty.stateCode,
          source: "direct_connect" as any,
          scope: "community",
          status: "open",
          visibility: "community",
          exposureMode: "guided",
          competitionMode: "none",
          createdAt: staleDate,
          updatedAt: staleDate,
        } as any,
      ])
      .returning();

    const localOpen = inserted.find((row: any) => String(row.title).includes("local open"));
    const localRouted = inserted.find((row: any) => String(row.title).includes("local routed"));
    const localCancelled = inserted.find((row: any) =>
      String(row.title).includes("local cancelled")
    );
    const localPrivate = inserted.find((row: any) => String(row.title).includes("local private"));
    const outOfCounty = inserted.find((row: any) => String(row.title).includes("other county"));
    const staleLocal = inserted.find((row: any) => String(row.title).includes("stale local"));

    const res = await agent.get(`/api/direct-connect/board?countyFips=${localCounty.fips}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const ids = (res.body as any[]).map((row) => String(row.id));
    expect(ids).toContain(String(localOpen?.id));
    expect(ids).toContain(String(localRouted?.id));
    expect(ids).not.toContain(String(localCancelled?.id));
    expect(ids).not.toContain(String(localPrivate?.id));
    expect(ids).not.toContain(String(outOfCounty?.id));
    expect(ids).not.toContain(String(staleLocal?.id));
    expect(
      (res.body as any[]).every((row) => ["open", "routed", "in_progress"].includes(row.status))
    ).toBe(true);
  }, 20_000);

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
    const [requestCounty] = await db.select().from(counties).limit(1);
    expect(requestCounty).toBeTruthy();

    await db
      .update(users)
      .set({
        countyFips: String((requestCounty as any).fips),
        stateCode: String((requestCounty as any).stateCode || "").toUpperCase(),
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, String(user.id)));

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
      countyFips: String((requestCounty as any).fips),
      stateCode: String((requestCounty as any).stateCode || "").toUpperCase(),
      attachments: [
        " private/direct-connect/00000000-0000-4000-8000-000000000001 ",
        "private/direct-connect/00000000-0000-4000-8000-000000000001",
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
    expect((storedRequest as any).attachments).toEqual([
      "private/direct-connect/00000000-0000-4000-8000-000000000001",
    ]);

    await db.insert(workRequestAssignments).values({
      workRequestId: requestId,
      contractorId: assignedContractor.id,
      status: "suggested",
    } as any);

    const ownerAttachmentRes = await agent.get(
      `/api/direct-connect/requests/${requestId}/attachments/0`
    );
    expect(ownerAttachmentRes.status).not.toBe(403);

    const assignedAttachmentRes = await assignedContractorAgent.get(
      `/api/direct-connect/requests/${requestId}/attachments/0`
    );
    expect(assignedAttachmentRes.status).not.toBe(403);

    const unrelatedAttachmentRes = await unrelatedAgent.get(
      `/api/direct-connect/requests/${requestId}/attachments/0`
    );
    expect(unrelatedAttachmentRes.status).toBe(403);
    expect(unrelatedAttachmentRes.body?.message).toContain("do not have access");
  }, 20_000);
});
