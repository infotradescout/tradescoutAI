import { and, desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { communityPosts, counties, countyNotes, events, states } from "@shared/schema";
import { db } from "../db";
import { createAuthedAgent, createUserOnly } from "./helpers/testAuth";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

vi.setConfig({ testTimeout: 45_000 });

const TARGET_STATE_CODE = "FL";
const TARGET_COUNTY_FIPS = "12999";
const ADMIN_STATE_CODE = "AL";
const ADMIN_COUNTY_FIPS = "01999";

// This suite is gated to the repository's disposable TEST_DATABASE_URL and must never target
// production. It verifies the real authenticated HTTP route and its persisted side effects.
describeWithDb("Community post county authority integration", () => {
  beforeAll(async () => {
    await db
      .insert(states)
      .values([
        { id: "d9-community-authority-fl", name: "Florida", code: TARGET_STATE_CODE },
        { id: "d9-community-authority-al", name: "Alabama", code: ADMIN_STATE_CODE },
      ])
      .onConflictDoNothing({ target: states.code });

    await db
      .insert(counties)
      .values([
        {
          id: "d9-community-authority-target-county",
          name: "D9 Target County",
          fips: TARGET_COUNTY_FIPS,
          stateCode: TARGET_STATE_CODE,
        },
        {
          id: "d9-community-authority-admin-county",
          name: "D9 Admin County",
          fips: ADMIN_COUNTY_FIPS,
          stateCode: ADMIN_STATE_CODE,
        },
      ])
      .onConflictDoNothing({ target: counties.fips });
  });

  it("persists and reflects county-table geography despite spoofed request geography", async () => {
    const { agent, user } = await createAuthedAgent({
      stateCode: TARGET_STATE_CODE,
      countyFips: TARGET_COUNTY_FIPS,
      onboardingCompleted: true,
    });
    const content = `Canonical county post ${crypto.randomUUID()}`;

    const response = await agent.post("/api/community/posts").send({
      title: "County authority proof",
      content,
      category: "question",
      images: ["https://images.example.test/county-proof.jpg"],
      scope: "global",
      stateCode: "ZZ",
      countyFips: "00000",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      authorId: user.id,
      scope: "county",
      stateCode: TARGET_STATE_CODE,
      countyFips: TARGET_COUNTY_FIPS,
      content,
      category: "question",
    });

    const [storedPost] = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, String(response.body.id)))
      .limit(1);
    expect(storedPost).toMatchObject({
      authorId: user.id,
      scope: "county",
      stateCode: TARGET_STATE_CODE,
      countyFips: TARGET_COUNTY_FIPS,
      content,
      category: "question",
    });

    const reflectedEvents = await db
      .select()
      .from(events)
      .where(and(eq(events.eventType, "post.created"), eq(events.userId, String(user.id))))
      .orderBy(desc(events.createdAt))
      .limit(10);
    const reflected = reflectedEvents.find(
      (event) => (event.data as Record<string, unknown> | null)?.postId === response.body.id
    );
    expect(reflected?.data).toMatchObject({
      postId: response.body.id,
      scope: "county",
      stateCode: TARGET_STATE_CODE,
      countyFips: TARGET_COUNTY_FIPS,
    });

    const [countyNote] = await db
      .select()
      .from(countyNotes)
      .where(
        and(
          eq(countyNotes.authorUserId, String(user.id)),
          eq(countyNotes.content, `community_post:${response.body.id}:scout_analysis`)
        )
      )
      .limit(1);
    expect(countyNote).toMatchObject({
      countyFips: TARGET_COUNTY_FIPS,
      authorUserId: user.id,
    });

    const refetchedFeed = await agent.get("/api/community/posts").query({
      scope: "county",
      stateCode: TARGET_STATE_CODE,
      countyFips: TARGET_COUNTY_FIPS,
      limit: "20",
      offset: "0",
    });
    expect(refetchedFeed.status).toBe(200);
    expect(refetchedFeed.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: response.body.id, content })])
    );
  });

  it("returns a stable error and performs no Community write for unknown persisted county geo", async () => {
    const { agent, user } = await createAuthedAgent({
      stateCode: "FL",
      countyFips: "00000",
      onboardingCompleted: true,
    });

    const response = await agent.post("/api/community/posts").send({
      title: "Must not persist",
      content: `Unknown county ${crypto.randomUUID()}`,
      category: "question",
      scope: "county",
      stateCode: "FL",
      countyFips: "12033",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Complete your county location before creating a Community post.",
      code: "COMMUNITY_COUNTY_CONTEXT_REQUIRED",
    });

    const userPosts = await db
      .select({ id: communityPosts.id })
      .from(communityPosts)
      .where(eq(communityPosts.authorId, String(user.id)));
    const userReflections = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.eventType, "post.created"), eq(events.userId, String(user.id))));
    const userCountyNotes = await db
      .select({ id: countyNotes.id })
      .from(countyNotes)
      .where(eq(countyNotes.authorUserId, String(user.id)));

    expect(userPosts).toEqual([]);
    expect(userReflections).toEqual([]);
    expect(userCountyNotes).toEqual([]);
  });

  it("does not let a super admin create without valid persisted county geo", async () => {
    const { agent, user } = await createAuthedAgent({
      role: "super_admin",
      stateCode: "",
      countyFips: "",
      onboardingCompleted: false,
    });

    const response = await agent.post("/api/community/posts").send({
      title: "Privilege must not widen scope",
      content: `Admin without county ${crypto.randomUUID()}`,
      category: "question",
      scope: "global",
      stateCode: "FL",
      countyFips: "12033",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Complete your county location before creating a Community post.",
      code: "COMMUNITY_COUNTY_CONTEXT_REQUIRED",
    });

    const [userPosts, userReflections, userCountyNotes] = await Promise.all([
      db
        .select({ id: communityPosts.id })
        .from(communityPosts)
        .where(eq(communityPosts.authorId, String(user.id))),
      db
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.eventType, "post.created"), eq(events.userId, String(user.id)))),
      db
        .select({ id: countyNotes.id })
        .from(countyNotes)
        .where(eq(countyNotes.authorUserId, String(user.id))),
    ]);

    expect(userPosts).toEqual([]);
    expect(userReflections).toEqual([]);
    expect(userCountyNotes).toEqual([]);
  });

  it("fails an acted-as create closed before the principal-location client refetch", async () => {
    const { agent: adminAgent, user: adminUser } = await createAuthedAgent({
      role: "super_admin",
      stateCode: ADMIN_STATE_CODE,
      countyFips: ADMIN_COUNTY_FIPS,
      onboardingCompleted: false,
    });
    const targetUser = await createUserOnly({
      role: "contractor",
      stateCode: TARGET_STATE_CODE,
      countyFips: TARGET_COUNTY_FIPS,
      onboardingCompleted: true,
    });

    const impersonation = await adminAgent
      .post(`/api/admin/impersonate/start/${targetUser.id}`)
      .send({ reason: "Verify Community effective target county authority." });
    expect(impersonation.status).toBe(200);

    const authContext = await adminAgent.get("/api/auth/user");
    expect(authContext.status).toBe(200);
    expect(authContext.body).toMatchObject({
      authenticated: true,
      user: {
        id: adminUser.id,
        stateCode: ADMIN_STATE_CODE,
        countyFips: ADMIN_COUNTY_FIPS,
        isImpersonating: true,
      },
    });

    const content = `Impersonated target county ${crypto.randomUUID()}`;
    const response = await adminAgent.post("/api/community/posts").send({
      title: "Acted-as write must remain unavailable",
      content,
      category: "question",
      scope: "global",
      stateCode: TARGET_STATE_CODE,
      countyFips: TARGET_COUNTY_FIPS,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Community posting is unavailable while acting as another user.",
      code: "COMMUNITY_IMPERSONATION_WRITE_UNAVAILABLE",
    });

    const clientRefetch = await adminAgent.get("/api/community/posts").query({
      scope: "county",
      stateCode: authContext.body.user.stateCode,
      countyFips: authContext.body.user.countyFips,
      limit: "20",
      offset: "0",
    });
    expect(clientRefetch.status).toBe(200);
    expect(clientRefetch.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ content })])
    );

    const targetIds = [String(targetUser.id), String(adminUser.id)];
    for (const authorId of targetIds) {
      const [posts, reflections, notes] = await Promise.all([
        db
          .select({ id: communityPosts.id })
          .from(communityPosts)
          .where(eq(communityPosts.authorId, authorId)),
        db
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.eventType, "post.created"), eq(events.userId, authorId))),
        db
          .select({ id: countyNotes.id })
          .from(countyNotes)
          .where(eq(countyNotes.authorUserId, authorId)),
      ]);
      expect(posts).toEqual([]);
      expect(reflections).toEqual([]);
      expect(notes).toEqual([]);
    }
  });
});
