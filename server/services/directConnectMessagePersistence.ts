import { and, eq, sql } from "drizzle-orm";
import { conversations, messages, notifications, type Message } from "@shared/schema";
import { db } from "../db";
import { notificationService } from "../notification-service";
import type { DirectConnectConversationAuthoritySuccess } from "./directConnectConversationAuthority";

const CLIENT_MESSAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const DIRECT_CONNECT_MESSAGE_TYPES = new Set(["text", "quote", "schedule", "materials", "image"]);

export class DirectConnectMessagePersistenceError extends Error {
  constructor(
    readonly code:
      | "CLIENT_MESSAGE_ID_REQUIRED"
      | "CLIENT_MESSAGE_ID_CONFLICT"
      | "CONVERSATION_CLOSED"
      | "MESSAGE_CONTENT_REQUIRED"
      | "SENDER_NOT_AUTHORIZED",
    message: string
  ) {
    super(message);
    this.name = "DirectConnectMessagePersistenceError";
  }
}

export type PersistDirectConnectMessageInput = {
  authority: DirectConnectConversationAuthoritySuccess;
  senderUserId: string;
  senderType: "homeowner" | "contractor" | "staff";
  content: string;
  messageType?: string;
  metadata?: Record<string, unknown>;
  clientMessageId: string;
};

export type PersistDirectConnectMessageResult = {
  message: Message;
  notificationId: string;
  idempotentReplay: boolean;
};

function normalizeClientMessageId(value: unknown): string {
  const clientMessageId = String(value || "").trim();
  if (!CLIENT_MESSAGE_ID_PATTERN.test(clientMessageId)) {
    throw new DirectConnectMessagePersistenceError(
      "CLIENT_MESSAGE_ID_REQUIRED",
      "A stable clientMessageId is required to send a Direct Connect message."
    );
  }
  return clientMessageId;
}

function normalizeMessageContent(value: unknown): string {
  const content = String(value || "").trim();
  if (!content || content.length > 10_000) {
    throw new DirectConnectMessagePersistenceError(
      "MESSAGE_CONTENT_REQUIRED",
      "Message content must be between 1 and 10,000 characters."
    );
  }
  return content;
}

export async function persistDirectConnectMessage(
  input: PersistDirectConnectMessageInput
): Promise<PersistDirectConnectMessageResult> {
  const clientMessageId = normalizeClientMessageId(input.clientMessageId);
  const content = normalizeMessageContent(input.content);
  const messageType = DIRECT_CONNECT_MESSAGE_TYPES.has(String(input.messageType || "text"))
    ? String(input.messageType || "text")
    : "text";
  const senderUserId = String(input.senderUserId || "").trim();
  if (!input.authority.authorizedParticipantUserIds.includes(senderUserId)) {
    throw new DirectConnectMessagePersistenceError(
      "SENDER_NOT_AUTHORIZED",
      "The sender is not authorized for this Direct Connect conversation."
    );
  }
  const conversationId = String(input.authority.conversation.id);
  const recipientUserId =
    input.authority.requesterUserId === senderUserId
      ? input.authority.providerUserId
      : input.authority.requesterUserId;
  const deliveryObligationKey =
    `direct-connect-message:${conversationId}:${senderUserId}:` + clientMessageId;

  return db.transaction(async (tx: any) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${deliveryObligationKey}, 0))`
    );
    const conversationLock = await tx.execute(sql`
      SELECT status::text AS status
      FROM conversations
      WHERE id = ${conversationId}
      FOR UPDATE
    `);
    if (String((conversationLock.rows?.[0] as any)?.status || "") !== "active") {
      throw new DirectConnectMessagePersistenceError(
        "CONVERSATION_CLOSED",
        "This conversation is closed."
      );
    }

    const [existingMessage] = await tx
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.senderId, senderUserId),
          sql`${messages.metadata} ->> 'workRequestId' = ${input.authority.workRequestId}`,
          sql`${messages.metadata} ->> 'clientMessageId' = ${clientMessageId}`
        )
      )
      .limit(1);
    const [existingNotification] = await tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, recipientUserId),
          sql`${notifications.metadata} ->> 'deliveryObligationKey' = ${deliveryObligationKey}`
        )
      )
      .limit(1);

    if (existingMessage && existingNotification?.id) {
      if (
        existingMessage.content !== content ||
        String(existingMessage.messageType || "text") !== messageType
      ) {
        throw new DirectConnectMessagePersistenceError(
          "CLIENT_MESSAGE_ID_CONFLICT",
          "This clientMessageId was already used for a different message."
        );
      }
      return {
        message: existingMessage,
        notificationId: String(existingNotification.id),
        idempotentReplay: true,
      };
    }

    if (
      existingMessage &&
      (existingMessage.content !== content ||
        String(existingMessage.messageType || "text") !== messageType)
    ) {
      throw new DirectConnectMessagePersistenceError(
        "CLIENT_MESSAGE_ID_CONFLICT",
        "This clientMessageId was already used for a different message."
      );
    }

    const now = new Date();
    const message =
      existingMessage ||
      (
        await tx
          .insert(messages)
          .values({
            conversationId,
            senderId: senderUserId,
            senderType: input.senderType,
            content,
            messageType: messageType as any,
            metadata: {
              ...(input.metadata || {}),
              clientMessageId,
              connectionId: input.authority.assignmentId,
              assignmentId: input.authority.assignmentId,
              workRequestId: input.authority.workRequestId,
            },
            createdAt: now,
          })
          .returning()
      )[0];
    if (!existingMessage) {
      await tx
        .update(conversations)
        .set({ lastMessageAt: now, updatedAt: now })
        .where(eq(conversations.id, conversationId));
    }

    const notification =
      existingNotification ||
      (await notificationService.enqueueNotification(tx, {
        userId: recipientUserId,
        type: "new_message",
        title: "New Direct Connect message",
        message: "You have a new message in an active Direct Connect request.",
        actionUrl: `/messages?thread=${encodeURIComponent(conversationId)}`,
        actionText: "Open conversation",
        iconName: "message-circle",
        iconColor: "blue",
        metadata: {
          workRequestId: input.authority.workRequestId,
          assignmentId: input.authority.assignmentId,
          conversationId,
          messageId: String(message.id),
          clientMessageId,
          emailPurpose: "direct_connect_request",
          notificationContext: "direct_connect_message",
          deliveryObligationKey,
        },
        deliveryMethods: ["in_app", "email"],
      }));

    return {
      message,
      notificationId: String(notification.id),
      idempotentReplay: Boolean(existingMessage),
    };
  });
}

export async function dispatchDirectConnectMessageNotification(
  notificationId: string
): Promise<void> {
  try {
    await notificationService.sendNotification(notificationId);
  } catch (error) {
    console.error("[direct-connect] Durable message notification dispatch deferred", {
      notificationId,
      error,
    });
  }
}
