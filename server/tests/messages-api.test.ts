import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import { conversations, messages, users, contractors } from "@shared/schema";
import { storage } from "../storage";
import { inArray, eq } from "drizzle-orm";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb("messages API helpers", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userAId = `msg-user-a-${runId}`;
  const contractorUserId = `msg-contractor-user-${runId}`;
  const contractorSlug = `test-contractor-msg-${runId}`;
  const seededConversationId = `test-conv-${runId}`;
  let contractorId: string;
  let conversationId: string;

  async function cleanupFixtures() {
    await db.delete(messages).where(inArray(messages.conversationId, [seededConversationId]));
    await db.delete(conversations).where(inArray(conversations.id, [seededConversationId]));

    await db.delete(contractors).where(eq(contractors.slug, contractorSlug as any));

    // User fixture IDs are unique per run. Avoid the unbounded parent-row
    // cascade across the long-lived test database; scoped child data is removed
    // above, matching the other integration fixture suites.
  }

  beforeAll(async () => {
    await cleanupFixtures();

    // Seed users
    await db.insert(users).values({
      id: userAId,
      email: `msg-a-${runId}@example.com`,
      firstName: "Msg",
      lastName: "A",
    } as any);

    await db.insert(users).values({
      id: contractorUserId,
      email: `msg-b-${runId}@example.com`,
      firstName: "Msg",
      lastName: "B",
    } as any);

    // Seed contractor with a unique slug
    const [contractor] = await db
      .insert(contractors)
      .values({
        userId: contractorUserId,
        companyName: "Test Contractor",
        slug: contractorSlug,
        email: `contractor-${runId}@example.com`,
      } as any)
      .returning();

    contractorId = contractor.id;

    // Seed conversation
    const [conv] = await db
      .insert(conversations)
      .values({
        id: seededConversationId,
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

  afterAll(async () => {
    await cleanupFixtures();
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
