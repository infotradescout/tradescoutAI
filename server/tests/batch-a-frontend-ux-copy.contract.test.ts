import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Batch A frontend UX copy contract", () => {
  it("keeps messages framed as an action center instead of an admin manager", () => {
    const source = [
      "client/src/components/messages/MessagesPanel.tsx",
      "client/src/pages/messages.tsx",
    ]
      .map(read)
      .join("\n\n");

    for (const phrase of [
      "Message Manager",
      "First-contact previews are required",
      "Approved requests unlock chat",
      "Contact Review",
      "Accepting opens a new conversation",
      "Share your Home Vault context",
    ]) {
      expect(source).not.toContain(phrase);
    }

    expect(source).toContain("Review requests before contact opens");
    expect(source).toContain("Conversation opens after acceptance");
    expect(source).toContain("Shared home context");
  });

  it("keeps notifications terminology user-facing without changing source architecture", () => {
    const source = [
      "client/src/pages/notifications.tsx",
      "client/src/components/NotificationsMenu.tsx",
      "client/src/components/ui/notification-center.tsx",
    ]
      .map(read)
      .join("\n\n");

    for (const phrase of [
      "system updates in one place",
      "Review Queue",
      "Activity Feed",
      "Unread conversations in your inbox",
      "waiting for approval",
      "No notifications yet",
    ]) {
      expect(source).not.toContain(phrase);
    }

    expect(source).toContain("Review requests");
    expect(source).toContain("Recent updates");
    expect(source).toContain("Unread message threads");
    expect(source).toContain("ready for review");
  });

  it("keeps Direct Connect residual copy out of chat/system-routing framing", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    for (const phrase of [
      "Post a job or a resume and chat through Scout",
      "Where should Scout focus?",
      "Too vague to route well",
      "Search widened",
      "Request canceled",
      "Request reopened",
      "Request completed",
      "TradeScout has already sent this request out",
      "work it again",
      "Local request routing",
      "Route to more pros",
      "Request routing saved",
      "Check replies",
      "Loading notifications",
    ]) {
      expect(source).not.toContain(phrase);
    }

    expect(source).toContain(
      "Tell people what you need, add photos if you have them, and send your request."
    );
    expect(source).toContain("Where should this request focus?");
    expect(source).toContain("Add more detail before review");
    expect(source).toContain("Send to more pros");
    expect(source).toContain("Open Messages");
  });
});
