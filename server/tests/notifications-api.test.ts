import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import {
  users,
  contractors,
  conversations,
  messages,
  homeownerAssociations,
  hoaMembers,
  hoaVotes,
  hoaVoteResponses,
} from "@shared/schema";
import { storage } from "../storage";
import { eq, inArray } from "drizzle-orm";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb("notifications summary helpers", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `notif-user-1-${runId}`;
  const contractorUserId = `notif-contractor-user-${runId}`;
  const contractorSlug = `notif-contractor-${runId}`;
  const seededConversationId = `notif-conv-${runId}`;
  const hoaName = `Notif Test HOA ${runId}`;
  const voteTitle = `Notif Test Vote ${runId}`;
  let contractorId: string;
  let conversationId: string;
  let hoaId: string;
  let voteId: string;

  async function cleanupFixtures() {
    await db.delete(messages).where(inArray(messages.conversationId, [seededConversationId]));
    await db.delete(conversations).where(inArray(conversations.id, [seededConversationId]));

    await db.delete(hoaVoteResponses).where(eq(hoaVoteResponses.userId, userId));
    await db.delete(hoaVotes).where(eq(hoaVotes.title, voteTitle));
    await db.delete(hoaMembers).where(eq(hoaMembers.userId, userId));
    if (hoaId) {
      await db.delete(homeownerAssociations).where(eq(homeownerAssociations.id, hoaId));
    }
    await db.delete(homeownerAssociations).where(eq(homeownerAssociations.name, hoaName));

    await db.delete(contractors).where(eq(contractors.slug, contractorSlug));
    await db.delete(users).where(inArray(users.id, [userId, contractorUserId]));
  }

  beforeAll(async () => {
    await cleanupFixtures();

    // Seed users
    await db.insert(users).values({
      id: userId,
      email: `notif-user-${runId}@example.com`,
      firstName: "Notif",
      lastName: "User",
    } as any);

    await db.insert(users).values({
      id: contractorUserId,
      email: `notif-contractor-${runId}@example.com`,
      firstName: "Notif",
      lastName: "Contractor",
    } as any);

    // Contractor
    const [contractor] = await db
      .insert(contractors)
      .values({
        userId: contractorUserId,
        companyName: "Notif Contractor",
        slug: contractorSlug,
        email: `notif-contractor-${runId}@example.com`,
      } as any)
      .returning();

    contractorId = contractor.id;

    // Conversation with two unread messages for userId
    const [conv] = await db
      .insert(conversations)
      .values({
        id: seededConversationId,
        homeownerId: userId,
        contractorId,
        status: "active",
      } as any)
      .returning();

    conversationId = conv.id;

    await db.insert(messages).values([
      {
        conversationId,
        senderId: contractorUserId,
        senderType: "contractor",
        content: "Unread message 1",
        messageType: "text",
      } as any,
      {
        conversationId,
        senderId: contractorUserId,
        senderType: "contractor",
        content: "Unread message 2",
        messageType: "text",
      } as any,
    ]);

    // HOA + vote the user has not yet answered
    const [hoa] = await db
      .insert(homeownerAssociations)
      .values({
        name: hoaName,
        address: "1 Test St",
        city: "Notif City",
        state: "TX",
        countyFips: "00101",
        totalUnits: 5,
      } as any)
      .returning();

    hoaId = hoa.id;

    await db.insert(hoaMembers).values({
      hoaId,
      userId,
      role: "member",
      inGoodStanding: true,
    } as any);

    const [vote] = await db
      .insert(hoaVotes)
      .values({
        hoaId,
        title: voteTitle,
        description: "Vote for notifications summary test",
        voteType: "rule_change",
        createdBy: userId,
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(Date.now() + 60 * 60 * 1000),
        requiredQuorum: 1,
        status: "active",
      } as any)
      .returning();

    voteId = vote.id;
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it("aggregates unreadThreads and openHoaVotes", async () => {
    const summary = await (storage as any).getNotificationsSummary(userId);

    expect(summary).toBeTruthy();
    expect(summary.unreadThreads).toBeGreaterThanOrEqual(2);
    expect(summary.openHoaVotes).toBeGreaterThanOrEqual(1);
  });

  it("drops HOA vote count after user votes", async () => {
    await (storage as any).submitHOAVote(userId, voteId, "for");

    const summary = await (storage as any).getNotificationsSummary(userId);
    expect(summary.openHoaVotes).toBe(0);
  });
});
