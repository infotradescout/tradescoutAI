export type ConversationSenderType =
  | "homeowner"
  | "contractor"
  | "staff"
  | "buyer"
  | "seller"
  | string;

type MessageAuthor = {
  senderId: string;
  senderType: ConversationSenderType;
  metadata?: Record<string, unknown> | null;
};

export function getMessageAuthorLabel(
  message: MessageAuthor,
  viewerUserId: string | null | undefined,
  fallbackParticipantName?: string | null
): string {
  if (viewerUserId && message.senderId === viewerUserId) return "You";

  if (message.senderType === "staff") {
    return "TradeScout staff";
  }

  switch (message.senderType) {
    case "homeowner":
      return "Homeowner";
    case "contractor":
      return "Provider";
    case "buyer":
      return "Buyer";
    case "seller":
      return "Seller";
    default:
      return fallbackParticipantName?.trim() || "Participant";
  }
}
