import { describe, expect, it } from "vitest";
import {
  adaptConversationThread,
  isSafeInternalHref,
  normalizeConversationContext,
} from "./conversationContextAdapter";

describe("conversation context adapter", () => {
  it("preserves thread identity, unread state, and timestamps while adding Exchange context", () => {
    const source = {
      id: "thread-1",
      subject: "Table saw",
      lastMessageSnippet: "Is pickup available?",
      lastMessageAt: "2026-07-13T12:00:00.000Z",
      unreadCount: 3,
      participantCount: 2,
      kind: "marketplace",
      context: {
        kind: "marketplace",
        label: "Exchange",
        title: "Table saw",
        href: "/exchange/tools/listing-1?from=messages",
      },
    } as const;

    const adapted = adaptConversationThread(source);

    expect(adapted).toMatchObject({
      id: "thread-1",
      unreadCount: 3,
      lastMessageAt: "2026-07-13T12:00:00.000Z",
      threadHref: "/messages?thread=thread-1",
      context: { kind: "marketplace", label: "Exchange", href: source.context.href },
    });
    expect(source.unreadCount).toBe(3);
  });

  it("rejects external, protocol-relative, and script links", () => {
    expect(isSafeInternalHref("/utilities/supply-run/order-1")).toBe(true);
    expect(isSafeInternalHref("https://example.com")).toBe(false);
    expect(isSafeInternalHref("//example.com/path")).toBe(false);
    expect(isSafeInternalHref("/\\example.com/path")).toBe(false);
    expect(isSafeInternalHref("javascript:alert(1)")).toBe(false);
    expect(
      normalizeConversationContext({ kind: "marketplace", href: "https://example.com" }).href
    ).toBeUndefined();
  });

  it("supports order-scoped procurement presentation without inventing inbox unread state", () => {
    expect(
      normalizeConversationContext({
        kind: "procurement",
        title: "SR-1042",
        entityId: "order-1",
      })
    ).toEqual({
      kind: "procurement",
      label: "Supply Run",
      title: "SR-1042",
      summary: undefined,
      href: undefined,
      entityId: "order-1",
    });
  });

  it("falls back safely when a server sends an unknown kind", () => {
    expect(normalizeConversationContext({ kind: "unknown", title: "Hello" })).toMatchObject({
      kind: "general",
      label: "Community",
      title: "Hello",
    });
  });
});
