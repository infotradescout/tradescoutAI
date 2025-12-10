import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import { conversations, messages, users, contractors } from "@shared/schema";
import { storage } from "../storage";
import { inArray, eq } from "drizzle-orm";

describe("messages API helpers", () => {
  const userAId = "msg-user-a";
  const contractorUserId = "msg-contractor-user";
  let contractorId: string;
  let conversationId: string;

  beforeAll(async () => {
    // Clean old data
    await db.delete(messages).where(inArray(messages.conversationId, ["test-conv-1"]));
    await db
      .delete(conversations)
      .where(inArray(conversations.id, ["test-conv-1"]));

    await db
      .delete(users)
      .where(inArray(users.id, [userAId, contractorUserId]));

    // Seed users
    await db.insert(users).values({
      id: userAId,
      email: "msg-a@example.com",
      firstName: "Msg",
      lastName: "A",
    } as any);

    await db.insert(users).values({
      id: contractorUserId,
      email: "msg-b@example.com",
      firstName: "Msg",
      lastName: "B",
    } as any);

    // Clean any prior contractors with the same slug to avoid unique constraint violations
    await db
      .delete(contractors)
      .where(eq(contractors.slug, "test-contractor-msg" as any));

    // Seed contractor with a unique slug
    const [contractor] = await db
      .insert(contractors)
      .values({
        userId: contractorUserId,
        companyName: "Test Contractor",
        slug: "test-contractor-msg",
        email: "contractor@example.com",
      } as any)
      .returning();

    contractorId = contractor.id;

    // Seed conversation
    const [conv] = await db
      .insert(conversations)
      .values({
        id: "test-conv-1",
        homeownerId: userAId,
        contractorId,
        status: "active",
      } as any)
      .returning();

    conversationId = conv.id;

    // Seed messages: two from contractor (unread for userA), one from userA
    await db.insert(messages).values([
      {
        conversationId,
        senderId: contractorUserId,
        senderType: "contractor",
        content: "Hello from contractor",
        messageType: "text",
      } as any,
      {
        conversationId,
        senderId: contractorUserId,
        senderType: "contractor",
        content: "Do you have project details?",
        messageType: "text",
      } as any,
      {
        conversationId,
        senderId: userAId,
        senderType: "homeowner",
        content: "Yes, I do",
        messageType: "text",
      } as any,
    ]);
  });

  it("getThreadsForUser returns thread with correct unreadCount", async () => {
    const threads = await storage.getThreadsForUser(userAId, {
      limit: 10,
      offset: 0,
    });

    expect(threads.length).toBeGreaterThan(0);
    const thread = threads.find((t) => t.id === conversationId);
    expect(thread).toBeDefined();
    expect(thread!.unreadCount).toBe(2);
    expect(thread!.lastMessageSnippet).toContain("Yes, I do");
  });

  it("getMessagesByConversation returns ordered messages", async () => {
    const convoMessages = await storage.getMessagesByConversation(conversationId);
    expect(convoMessages.length).toBe(3);
    // Should be ordered by createdAt ascending
    const contents = convoMessages.map((m) => m.content);
    expect(contents[0]).toBe("Hello from contractor");
    expect(contents[contents.length - 1]).toBe("Yes, I do");
  });
});
