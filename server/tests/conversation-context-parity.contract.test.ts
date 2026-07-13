import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("conversation context parity contracts", () => {
  it("keeps synthetic approved-contact threads visible without a listing row", () => {
    const storage = read("server/storage.ts");
    const method = storage.slice(
      storage.indexOf("async getUserMarketplaceConversations"),
      storage.indexOf("async createMarketplaceMessage")
    );
    expect(method).toMatch(/\.leftJoin\(\s*marketplaceListings/);
    expect(method).toContain("marketplaceCategories.name");
  });

  it("marks only an authorized selected thread read through the canonical API", () => {
    const routes = read("server/routes.ts");
    expect(routes).toContain('"/api/messages/threads/:threadId/read"');
    expect(routes).toContain("storage.markMarketplaceMessagesAsRead(threadId, userId)");
    expect(routes).toContain("message.senderId !== userId && !message.readAt");
    expect(routes).toContain('return res.status(403).json({ message: "Access denied" })');
  });

  it("honors request deep links and keeps procurement messages order-scoped", () => {
    const messagesPanel = read("client/src/components/messages/MessagesPanel.tsx");
    const procurement = read("client/src/pages/procurement/ProcurementPages.tsx");
    expect(messagesPanel).toContain('searchParams.get("requestId")');
    expect(messagesPanel).toContain('apiRequest("PUT", `/api/messages/threads/${threadId}/read`)');
    expect(procurement).toContain('data-testid="procurement-order-messages"');
    expect(procurement).toContain("Updates shown here stay attached to this order");
  });
});
