export type ConversationContextKind =
  | "general"
  | "direct_connect"
  | "marketplace"
  | "platform_support"
  | "procurement";

export type ApiConversationContext = {
  kind?: ConversationContextKind | string | null;
  label?: string | null;
  title?: string | null;
  summary?: string | null;
  href?: string | null;
  entityId?: string | null;
};

export type ConversationContext = {
  kind: ConversationContextKind;
  label: string;
  title: string;
  summary?: string;
  href?: string;
  entityId?: string;
};

const labels: Record<ConversationContextKind, string> = {
  general: "Community",
  direct_connect: "Direct Connect",
  marketplace: "Exchange",
  platform_support: "TradeScout Support",
  procurement: "Supply Run",
};

function cleanText(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

export function isSafeInternalHref(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const href = value.trim();
  return (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(href) &&
    !/^[a-z][a-z\d+.-]*:/i.test(href)
  );
}

export function normalizeConversationContext(
  input: ApiConversationContext | null | undefined,
  fallbackTitle = "Conversation"
): ConversationContext {
  const rawKind = cleanText(input?.kind);
  const kind: ConversationContextKind =
    rawKind && Object.prototype.hasOwnProperty.call(labels, rawKind)
      ? (rawKind as ConversationContextKind)
      : "general";
  const href = isSafeInternalHref(input?.href) ? input.href.trim() : undefined;

  return {
    kind,
    label: cleanText(input?.label) || labels[kind],
    title: cleanText(input?.title) || cleanText(fallbackTitle) || "Conversation",
    summary: cleanText(input?.summary),
    href,
    entityId: cleanText(input?.entityId),
  };
}

export type AdaptableApiThread = {
  id: string;
  subject: string | null;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  participantCount: number;
  kind?: ConversationContextKind | string | null;
  context?: ApiConversationContext | null;
  participant?: { id: string; name: string; profileImageUrl?: string | null } | null;
};

export function adaptConversationThread<T extends AdaptableApiThread>(thread: T) {
  const context = normalizeConversationContext(
    thread.context || { kind: thread.kind },
    thread.subject || "Conversation"
  );
  return {
    ...thread,
    subject: context.title,
    context,
    threadHref: `/messages?thread=${encodeURIComponent(thread.id)}`,
  };
}
