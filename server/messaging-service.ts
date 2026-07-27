import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { db } from "./db";
import { contractors, conversations, messages, users } from "@shared/schema";
import { eq, and, or, desc, sql, ne, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "./auth";
import {
  getDirectConnectConversationSenderType,
  isAuthorizedDirectConnectConversationParticipant,
  isDirectConnectMessageScopedToRequest,
  resolveDirectConnectConversationAuthority,
  sanitizeDirectConnectParticipantMessageMetadata,
} from "./services/directConnectConversationAuthority";
import {
  dispatchDirectConnectMessageNotification,
  persistDirectConnectMessage,
} from "./services/directConnectMessagePersistence";

const PORT = parseInt(process.env.PORT || "5000", 10);

const SOCKET_ALLOWED_ORIGINS: string[] = [
  "https://www.thetradescout.com",
  "https://thetradescout.com",
  "https://tradescoutai.onrender.com",
].map((o) => o.toLowerCase());

const rawAllowlist = process.env.CORS_ALLOWED_ORIGINS || "";
const allowAllCorsRequested = rawAllowlist === "*";
const isProductionEnv =
  process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
const allowAllCors = allowAllCorsRequested && !isProductionEnv;

if (allowAllCorsRequested && isProductionEnv) {
  console.error(
    "[Messaging] Refusing CORS_ALLOWED_ORIGINS='*' in production; falling back to explicit allowlist only."
  );
}

if (rawAllowlist && rawAllowlist !== "*") {
  for (const origin of rawAllowlist.split(",")) {
    const normalized = origin.trim().toLowerCase();
    if (!normalized) continue;
    if (!SOCKET_ALLOWED_ORIGINS.includes(normalized)) {
      SOCKET_ALLOWED_ORIGINS.push(normalized);
    }
  }
}

if (!isProductionEnv) {
  const devOrigins = ["http://localhost:3000", "http://localhost:5173", `http://localhost:${PORT}`];
  for (const devOrigin of devOrigins) {
    if (!SOCKET_ALLOWED_ORIGINS.includes(devOrigin)) {
      SOCKET_ALLOWED_ORIGINS.push(devOrigin);
    }
  }
}

function isSocketOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = origin.toLowerCase();

  if (allowAllCors) return true;

  if (!isProductionEnv && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
    return true;
  }

  if (!isProductionEnv) {
    const sameHostOrigins = [
      `http://localhost:${PORT}`.toLowerCase(),
      `https://localhost:${PORT}`.toLowerCase(),
    ];
    if (sameHostOrigins.includes(normalized)) {
      return true;
    }
  }

  return SOCKET_ALLOWED_ORIGINS.includes(normalized);
}

const socketSessionMiddleware = getSession();
const socketSessionResShim: any = {
  getHeader: () => undefined,
  setHeader: () => undefined,
};

async function loadSocketSession(socket: Socket): Promise<any | null> {
  return await new Promise((resolve, reject) => {
    try {
      socketSessionMiddleware(socket.request as any, socketSessionResShim, (err: any) => {
        if (err) return reject(err);
        resolve((socket.request as any).session ?? null);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function extractSessionUserId(session: any): string | null {
  const passportUser = session?.passport?.user;

  if (typeof passportUser === "string" && passportUser.trim()) {
    return passportUser.trim();
  }

  if (passportUser && typeof passportUser === "object") {
    const idCandidate = (passportUser as any).id ?? (passportUser as any)?.claims?.sub;
    if (typeof idCandidate === "string" && idCandidate.trim()) {
      return idCandidate.trim();
    }
  }

  return null;
}

interface ConnectedUser {
  userId: string;
  socket: Socket;
  conversationIds: Set<string>;
}

export class MessagingService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, ConnectedUser> = new Map();
  private messageQueue: Map<string, any[]> = new Map();
  private redisPubClient: unknown = null;
  private redisSubClient: unknown = null;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (isSocketOriginAllowed(origin)) return callback(null, true);
          return callback(new Error("Socket origin not allowed"), false);
        },
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingInterval: 25000,
      pingTimeout: 10000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    void this.attachRedisAdapter();
  }

  private async attachRedisAdapter() {
    const redisUrl = String(process.env.REDIS_URL || "").trim();
    if (!redisUrl) {
      return;
    }

    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      await pubClient.connect();
      await subClient.connect();

      this.io.adapter(createAdapter(pubClient, subClient));
      this.redisPubClient = pubClient;
      this.redisSubClient = subClient;

      console.log("[Messaging] Redis adapter enabled for multi-instance fanout");
    } catch (error) {
      console.warn(
        "[Messaging] Redis adapter setup failed; continuing with single-instance adapter",
        error
      );
    }
  }

  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const session = await loadSocketSession(socket);
        const sessionUserId = extractSessionUserId(session);
        if (!sessionUserId) {
          return next(new Error("Authentication failed: missing session user"));
        }

        const requestedUserId = String((socket.handshake.auth as any)?.userId || "").trim();
        if (requestedUserId && requestedUserId !== sessionUserId) {
          console.warn(
            `[Messaging] Ignoring client-provided userId (${requestedUserId}) that does not match session userId (${sessionUserId}).`
          );
        }

        const impersonatedUserId = String((session as any)?.impersonatedUserId || "").trim();
        const isImpersonating =
          (session as any)?.isImpersonating === true && Boolean((session as any)?.originalUser);
        const effectiveUserId =
          isImpersonating && impersonatedUserId ? impersonatedUserId : sessionUserId;

        // Verify user exists
        const user = await db.select().from(users).where(eq(users.id, effectiveUserId)).limit(1);
        if (!user || user.length === 0) {
          return next(new Error("Authentication failed: user not found"));
        }

        socket.data.userId = effectiveUserId;
        socket.data.sessionUserId = sessionUserId;
        socket.data.isImpersonating = isImpersonating && Boolean(impersonatedUserId);

        next();
      } catch (error) {
        next(new Error(`Authentication error: ${(error as Error).message}`));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: Socket) => {
      const userId = socket.data.userId as string;
      console.log(`[Messaging] User connected: ${userId} (socket: ${socket.id})`);

      // Register user
      this.connectedUsers.set(userId, {
        userId,
        socket,
        conversationIds: new Set(),
      });

      // Load user's conversations
      socket.on("load_conversations", async (cb) => {
        try {
          const participantRows = await db
            .select({ conversation: conversations })
            .from(conversations)
            .leftJoin(contractors, eq(contractors.id, conversations.contractorId))
            .where(
              or(
                eq(conversations.homeownerId, userId),
                eq(conversations.contractorId, userId),
                eq(contractors.userId, userId)
              )
            )
            .orderBy(desc(conversations.lastMessageAt));
          const uniqueConversations: Array<(typeof participantRows)[number]["conversation"]> =
            Array.from(
              new Map(
                participantRows.map(({ conversation }) => [conversation.id, conversation] as const)
              ).values()
            );
          const userConversations = (
            await Promise.all(
              uniqueConversations.map(async (conversation) => {
                const authority = await resolveDirectConnectConversationAuthority(conversation.id);
                return authority.ok &&
                  isAuthorizedDirectConnectConversationParticipant(authority, userId)
                  ? authority.conversation
                  : null;
              })
            )
          ).filter((conversation): conversation is NonNullable<typeof conversation> =>
            Boolean(conversation)
          );

          const connectedUser = this.connectedUsers.get(userId);
          if (connectedUser) {
            userConversations.forEach((conv: any) => {
              connectedUser.conversationIds.add(conv.id);
              socket.join(`conversation:${conv.id}`);
            });
          }

          cb({ success: true, conversations: userConversations });
        } catch (error) {
          console.error("[Messaging] Error loading conversations:", error);
          cb({ success: false, error: (error as Error).message });
        }
      });

      // Join conversation
      socket.on("join_conversation", async (conversationId: string, cb) => {
        try {
          const authority = await resolveDirectConnectConversationAuthority(conversationId);
          if (
            !authority.ok ||
            !isAuthorizedDirectConnectConversationParticipant(authority, userId)
          ) {
            return cb({ success: false, error: "Not authorized for this conversation" });
          }

          const connectedUser = this.connectedUsers.get(userId);
          if (connectedUser) {
            connectedUser.conversationIds.add(conversationId);
          }

          socket.join(`conversation:${conversationId}`);

          // Load message history
          const newestMessageHistory = await db
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.conversationId, conversationId),
                sql`${messages.metadata} ->> 'workRequestId' = ${authority.workRequestId}`
              )
            )
            .orderBy(desc(messages.createdAt), desc(messages.id))
            .limit(50);
          const messageHistory = newestMessageHistory
            .filter((message) =>
              isDirectConnectMessageScopedToRequest(message.metadata, authority.workRequestId)
            )
            .reverse();

          cb({ success: true, messages: messageHistory });
        } catch (error) {
          console.error("[Messaging] Error joining conversation:", error);
          cb({ success: false, error: (error as Error).message });
        }
      });

      // Send message
      socket.on("send_message", async (data, cb) => {
        try {
          const { conversationId, content, messageType = "text", metadata, clientMessageId } = data;

          const authority = await resolveDirectConnectConversationAuthority(conversationId);
          if (
            !authority.ok ||
            !isAuthorizedDirectConnectConversationParticipant(authority, userId)
          ) {
            return cb({ success: false, error: "Not authorized for this conversation" });
          }
          if (authority.conversationStatus !== "active") {
            return cb({ success: false, error: "This conversation is closed" });
          }

          const senderType = getDirectConnectConversationSenderType(authority, userId);
          if (!senderType) {
            return cb({ success: false, error: "Not authorized for this conversation" });
          }

          // [USER-CONTEXT] Track interaction type for language personalization
          // This metadata helps Scout understand user preferences and communication patterns
          const interactionMetadata = {
            ...sanitizeDirectConnectParticipantMessageMetadata(metadata),
            _interactionSignature: extractInteractionSignature(content),
            _messageType: messageType,
            _senderType: senderType,
            connectionId: authority.assignmentId,
            assignmentId: authority.assignmentId,
            workRequestId: authority.workRequestId,
          };

          const persisted = await persistDirectConnectMessage({
            authority,
            senderUserId: userId,
            senderType,
            content,
            messageType,
            metadata: interactionMetadata,
            clientMessageId,
          });
          await dispatchDirectConnectMessageNotification(persisted.notificationId);
          const messageId = String(persisted.message.id);

          // Broadcast message to conversation participants
          const messageData = {
            ...persisted.message,
            id: messageId,
            idempotentReplay: persisted.idempotentReplay,
          };

          this.io.to(`conversation:${conversationId}`).emit("new_message", messageData);

          // Emit notification to other user
          const otherUserId =
            authority.requesterUserId === userId
              ? authority.providerUserId
              : authority.requesterUserId;

          const otherUserConnection = this.connectedUsers.get(otherUserId);
          if (otherUserConnection) {
            otherUserConnection.socket.emit("message_notification", {
              conversationId,
              senderId: userId,
              senderType,
              message: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
              createdAt: new Date(),
            });
          }

          cb({
            success: true,
            message: messageData,
            idempotentReplay: persisted.idempotentReplay,
          });
        } catch (error) {
          console.error("[Messaging] Error sending message:", error);
          cb({ success: false, error: (error as Error).message });
        }
      });

      // Mark message as read
      socket.on("mark_read", async (messageId: string, cb) => {
        try {
          const [message] = await db
            .select()
            .from(messages)
            .where(eq(messages.id, messageId))
            .limit(1);
          if (!message) {
            return cb({ success: false, error: "Message not found" });
          }

          const authority = await resolveDirectConnectConversationAuthority(message.conversationId);
          if (
            !authority.ok ||
            !isAuthorizedDirectConnectConversationParticipant(authority, userId) ||
            !isDirectConnectMessageScopedToRequest(message.metadata, authority.workRequestId)
          ) {
            return cb({ success: false, error: "Not authorized to update this message" });
          }
          if (String(message.senderId) === userId) {
            return cb({ success: false, error: "A sender cannot mark their own message as read" });
          }

          const readAt = new Date();
          const [updatedMessage] = await db
            .update(messages)
            .set({ readAt })
            .where(
              and(
                eq(messages.id, messageId),
                eq(messages.conversationId, authority.conversation.id),
                ne(messages.senderId, userId),
                isNull(messages.readAt),
                sql`${messages.metadata} ->> 'workRequestId' = ${authority.workRequestId}`
              )
            )
            .returning({ id: messages.id });
          if (!updatedMessage) {
            return cb({ success: true, alreadyRead: true });
          }

          // Broadcast read receipt
          this.io.to(`conversation:${message.conversationId}`).emit("message_read", {
            messageId,
            readAt,
          });

          cb({ success: true });
        } catch (error) {
          console.error("[Messaging] Error marking read:", error);
          cb({ success: false, error: (error as Error).message });
        }
      });

      // Typing indicator
      socket.on("typing", (conversationId: string) => {
        if (!conversationId) return;
        const connectedUser = this.connectedUsers.get(userId);
        if (!connectedUser?.conversationIds.has(conversationId)) return;

        socket.broadcast.to(`conversation:${conversationId}`).emit("user_typing", {
          userId,
          conversationId,
        });
      });

      // Stop typing
      socket.on("stop_typing", (conversationId: string) => {
        if (!conversationId) return;
        const connectedUser = this.connectedUsers.get(userId);
        if (!connectedUser?.conversationIds.has(conversationId)) return;

        socket.broadcast.to(`conversation:${conversationId}`).emit("user_stopped_typing", {
          userId,
          conversationId,
        });
      });

      // Disconnect
      socket.on("disconnect", () => {
        console.log(`[Messaging] User disconnected: ${userId} (socket: ${socket.id})`);
        this.connectedUsers.delete(userId);
      });
    });
  }

  // Public method to get IO instance
  getIO(): SocketIOServer {
    return this.io;
  }

  // Create a conversation
  async createConversation(homeownerId: string, contractorId: string) {
    try {
      // Check if conversation already exists
      const existing = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.homeownerId, homeownerId),
            eq(conversations.contractorId, contractorId)
          )
        )
        .limit(1);

      if (existing && existing.length > 0) {
        return existing[0];
      }

      // Create new conversation
      const id = uuidv4();
      await db.insert(conversations).values({
        id,
        homeownerId,
        contractorId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const newConv = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1);

      return newConv[0];
    } catch (error) {
      console.error("[Messaging] Error creating conversation:", error);
      throw error;
    }
  }

  // Notify user in real-time
  notifyUser(userId: string, eventName: string, data: any) {
    const user = this.connectedUsers.get(userId);
    if (user) {
      user.socket.emit(eventName, data);
    }
  }

  // Broadcast to all connected users
  broadcastToAll(eventName: string, data: any) {
    this.io.emit(eventName, data);
  }
}

/**
 * Extract interaction signature from message content
 * Helps Scout understand user communication patterns and preferences
 */
function extractInteractionSignature(content: string): string[] {
  const signatures: string[] = [];
  const lower = content.toLowerCase();

  // Communication style
  if (/[!]{2,}|[?]{2,}|^\s*YES|^\s*NO|very|extremely/.test(lower)) {
    signatures.push("emphatic");
  }
  if (/please|thanks|thank you|would you|could you/.test(lower)) {
    signatures.push("formal_polite");
  }
  if (/hey|thanks|cool|awesome|great/.test(lower)) {
    signatures.push("casual_friendly");
  }

  // Domain signals
  if (/roofing|plumb|electric|hvac|contractor|build|construct|renovate|install/.test(lower)) {
    signatures.push("construction_domain");
  }
  if (/price|cost|budget|afford|expensive|cheap/.test(lower)) {
    signatures.push("pricing_focused");
  }
  if (/timeline|urgent|rush|asap|soon|available|schedule/.test(lower)) {
    signatures.push("time_sensitive");
  }
  if (/review|quality|experience|recommend|trustworthy|verify/.test(lower)) {
    signatures.push("quality_conscious");
  }

  // Relationship signals
  if (/community|neighbor|local|area|county|nearby/.test(lower)) {
    signatures.push("community_engaged");
  }
  if (/business|offer|service|client|customer|hire/.test(lower)) {
    signatures.push("business_service");
  }

  return signatures.length > 0 ? signatures : ["neutral"];
}

// Helper to manage Socket.io service globally
let messagingService: MessagingService | null = null;

export function initializeMessagingService(httpServer: HTTPServer): MessagingService {
  messagingService = new MessagingService(httpServer);
  return messagingService;
}

export function getMessagingService(): MessagingService {
  if (!messagingService) {
    throw new Error("Messaging service not initialized");
  }
  return messagingService;
}
