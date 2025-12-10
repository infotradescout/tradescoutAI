import { describe, it, expect, beforeAll } from "vitest";
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

describe("notifications summary helpers", () => {
  const userId = "notif-user-1";
  const contractorUserId = "notif-contractor-user";
  let contractorId: string;
  let conversationId: string;
  let hoaId: string;
  let voteId: string;

  beforeAll(async () => {
    // Clean up any prior runs
    await db
      .delete(messages)
      .where(inArray(messages.conversationId, ["notif-conv-1"]));
    await db
      .delete(conversations)
      .where(inArray(conversations.id, ["notif-conv-1"]));

    await db
      .delete(hoaVoteResponses)
      .where(eq(hoaVoteResponses.userId, userId));
    await db
      .delete(hoaVotes)
      .where(eq(hoaVotes.title, "Notif Test Vote"));
    await db
      .delete(hoaMembers)
      .where(eq(hoaMembers.userId, userId));
    await db
      .delete(homeownerAssociations)
      .where(eq(homeownerAssociations.name, "Notif Test HOA"));

    await db
      .delete(contractors)
      .where(eq(contractors.slug, "notif-contractor"));
    await db
      .delete(users)
      .where(inArray(users.id, [userId, contractorUserId]));

    // Seed users
    await db.insert(users).values({
      id: userId,
      email: "notif-user@example.com",
      firstName: "Notif",
      lastName: "User",
    } as any);

    await db.insert(users).values({
      id: contractorUserId,
      email: "notif-contractor@example.com",
      firstName: "Notif",
      lastName: "Contractor",
    } as any);

    // Contractor
    const [contractor] = await db
      .insert(contractors)
      .values({
        userId: contractorUserId,
        companyName: "Notif Contractor",
        slug: "notif-contractor",
        email: "notif-contractor@example.com",
      } as any)
      .returning();

    contractorId = contractor.id;

    // Conversation with two unread messages for userId
    const [conv] = await db
      .insert(conversations)
      .values({
        id: "notif-conv-1",
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
        name: "Notif Test HOA",
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
        title: "Notif Test Vote",
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
