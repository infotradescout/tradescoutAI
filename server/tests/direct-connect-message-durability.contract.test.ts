import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createClientMessageId } from "../../client/src/lib/clientMessageId";
import { persistDirectConnectMessage } from "../services/directConnectMessagePersistence";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");

function routeBlock(source: string, route: string): string {
  const markers = [`app.post(\n    "${route}"`, `app.post("${route}"`];
  const start = markers.map((marker) => source.indexOf(marker)).find((candidate) => candidate >= 0);
  expect(start, `Missing POST route ${route}`).toBeGreaterThan(-1);
  const routeStart = start as number;
  const end = source.indexOf("\n  app.", routeStart + route.length);
  return source.slice(routeStart, end === -1 ? source.length : end);
}

function boundedBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `Missing end marker: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("Direct Connect message durability", () => {
  const routes = read("server/routes.ts");
  const websocket = read("server/messaging-service.ts");
  const persistence = read("server/services/directConnectMessagePersistence.ts");
  const notificationService = read("server/notification-service.ts");
  const messagingHook = read("client/src/hooks/useMessaging.ts");
  const messagingPanel = read("client/src/components/MessagingPanel.tsx");
  const messagesPanel = read("client/src/components/messages/MessagesPanel.tsx");
  const chatPage = read("client/src/pages/chat.tsx");

  it("routes both REST surfaces and WebSocket sends through one durable persistence path", () => {
    const restRoutes = [
      routeBlock(routes, "/api/messages/threads/:threadId/messages"),
      routeBlock(routes, "/api/conversations/:id/messages"),
    ];
    const socketSend = boundedBlock(websocket, 'socket.on("send_message"', 'socket.on("mark_read"');

    for (const transport of [...restRoutes, socketSend]) {
      expect(transport).toContain("persistDirectConnectMessage({");
      expect(transport).toContain("clientMessageId,");
      expect(transport).toContain(
        "dispatchDirectConnectMessageNotification(persisted.notificationId)"
      );
      expect(transport.indexOf("persistDirectConnectMessage({")).toBeLessThan(
        transport.indexOf("dispatchDirectConnectMessageNotification")
      );
    }
  });

  it("requires a valid stable clientMessageId and reuses it for an unchanged retry", async () => {
    const invalidInput = {
      authority: {
        authorizedParticipantUserIds: ["sender"],
      },
      senderUserId: "sender",
      senderType: "homeowner" as const,
      content: "Still interested",
      clientMessageId: "",
    };

    await expect(persistDirectConnectMessage(invalidInput as any)).rejects.toMatchObject({
      code: "CLIENT_MESSAGE_ID_REQUIRED",
    });
    await expect(
      persistDirectConnectMessage({
        ...invalidInput,
        clientMessageId: "bad!",
      } as any)
    ).rejects.toMatchObject({
      code: "CLIENT_MESSAGE_ID_REQUIRED",
    });

    const generated = [createClientMessageId(), createClientMessageId()];
    expect(generated[0]).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/);
    expect(generated[1]).not.toBe(generated[0]);

    for (const client of [messagingHook, messagesPanel, chatPage]) {
      expect(client).toContain("pendingSendRef.current?.fingerprint === fingerprint");
      expect(client).toContain("? pendingSendRef.current.clientMessageId");
      expect(client).toContain(": createClientMessageId()");
      expect(client).toContain("clientMessageId");
    }
  });

  it("atomically persists the message, recipient notification, and notification outbox", () => {
    const transactionStart = persistence.indexOf("return db.transaction");
    const messageInsert = persistence.indexOf(".insert(messages)", transactionStart);
    const notificationEnqueue = persistence.indexOf(
      "notificationService.enqueueNotification(tx",
      transactionStart
    );

    expect(transactionStart).toBeGreaterThan(-1);
    expect(persistence).toContain("input.authority.requesterUserId === senderUserId");
    expect(persistence).toContain("? input.authority.providerUserId");
    expect(persistence).toContain(": input.authority.requesterUserId");
    expect(messageInsert).toBeGreaterThan(transactionStart);
    expect(notificationEnqueue).toBeGreaterThan(messageInsert);
    expect(persistence).toContain('deliveryMethods: ["in_app", "email"]');
    expect(persistence).toContain("userId: recipientUserId");

    const enqueue = boundedBlock(
      notificationService,
      "async enqueueNotification(tx: any",
      "async createNotification("
    );
    expect(enqueue).toContain("tx.insert(notifications)");
    expect(enqueue).toContain("tx.insert(notificationDeliveryLog)");
    expect(enqueue).toContain('status: deliveryMethod === "in_app" ? "delivered" : "pending"');
  });

  it("replays one delivery obligation without duplicating messages or notification sends", () => {
    expect(persistence).toContain(
      "`direct-connect-message:${conversationId}:${senderUserId}:` + clientMessageId"
    );
    expect(persistence).toContain(
      "pg_advisory_xact_lock(hashtextextended(${deliveryObligationKey}, 0))"
    );
    expect(persistence).toContain(
      "sql`${messages.metadata} ->> 'clientMessageId' = ${clientMessageId}`"
    );
    expect(persistence).toContain(
      "sql`${notifications.metadata} ->> 'deliveryObligationKey' = ${deliveryObligationKey}`"
    );

    const completedReplay = boundedBlock(
      persistence,
      "if (existingMessage && existingNotification?.id)",
      "if (\n      existingMessage &&"
    );
    expect(completedReplay).toContain("message: existingMessage");
    expect(completedReplay).toContain("notificationId: String(existingNotification.id)");
    expect(completedReplay).toContain("idempotentReplay: true");
    expect(persistence).toContain("existingMessage ||");
    expect(persistence).toContain("existingNotification ||");
    expect(persistence).toContain("idempotentReplay: Boolean(existingMessage)");

    const dispatch = boundedBlock(
      persistence,
      "export async function dispatchDirectConnectMessageNotification",
      "\n}"
    );
    expect(dispatch).toContain("notificationService.sendNotification(notificationId)");

    const claims = boundedBlock(
      notificationService,
      "private async claimDueEmailDeliveries",
      "protected async persistAcceptedEmailDelivery"
    );
    expect(claims).toContain("ndl.status IN ('pending', 'retry_scheduled')");
    expect(claims).not.toContain("ndl.status IN ('sent'");
  });

  it("keeps the socket draft and retry identity until a successful acknowledgement", () => {
    const hookSend = boundedBlock(
      messagingHook,
      "const sendMessage = useCallback(",
      "// Mark message as read"
    );
    const timeout = boundedBlock(
      hookSend,
      "const acknowledgementTimeout",
      'socket.emit(\n          "send_message"'
    );
    const acknowledgement = boundedBlock(
      hookSend,
      "(response: any) => {",
      "\n          }\n        );"
    );
    const failedAcknowledgement = boundedBlock(
      acknowledgement,
      "if (!response?.success)",
      "} else {"
    );
    const successfulAcknowledgement = acknowledgement.slice(acknowledgement.indexOf("} else {"));
    const panelSend = boundedBlock(
      messagingPanel,
      "const handleSendMessage = async () =>",
      "const handleMessageInputChange"
    );

    expect(timeout).toContain("reject(timeoutError)");
    expect(timeout).not.toContain("pendingSendRef.current = null");
    expect(acknowledgement).toContain("if (!response?.success)");
    expect(acknowledgement).toContain(
      "pendingSendRef.current?.clientMessageId === clientMessageId"
    );
    expect(failedAcknowledgement).toContain("reject(new Error(responseError))");
    expect(failedAcknowledgement).not.toContain("pendingSendRef.current = null");
    expect(successfulAcknowledgement).toContain("pendingSendRef.current = null");
    expect(successfulAcknowledgement).toContain("resolve()");
    expect(panelSend.indexOf('await sendMessage(messageInput, "text")')).toBeLessThan(
      panelSend.indexOf('setMessageInput("")')
    );
    expect(panelSend).not.toContain('setMessageInput("");\n      await sendMessage');
  });
});
