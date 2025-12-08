import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { db } from './db';
import { conversations, messages, users } from '@shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface ConnectedUser {
  userId: string;
  socket: Socket;
  conversationIds: Set<string>;
}

export class MessagingService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, ConnectedUser> = new Map();
  private messageQueue: Map<string, any[]> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 10000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const session = (socket.handshake.auth as any)?.session;
        const userId = (socket.handshake.auth as any)?.userId;

        if (!userId) {
          return next(new Error('Authentication failed: missing userId'));
        }

        // Verify user exists
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user || user.length === 0) {
          return next(new Error('Authentication failed: user not found'));
        }

        socket.data.userId = userId;
        next();
      } catch (error) {
        next(new Error(`Authentication error: ${(error as Error).message}`));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.userId as string;
      console.log(`[Messaging] User connected: ${userId} (socket: ${socket.id})`);

      // Register user
      this.connectedUsers.set(userId, {
        userId,
        socket,
        conversationIds: new Set(),
      });

      // Load user's conversations
      socket.on('load_conversations', async (cb) => {
        try {
          const userConversations = await db
            .select()
            .from(conversations)
            .where(
              or(
                eq(conversations.homeownerId, userId),
                eq(conversations.contractorId, userId)
              )
            )
            .orderBy(desc(conversations.lastMessageAt));

          const connectedUser = this.connectedUsers.get(userId);
          if (connectedUser) {
            userConversations.forEach((conv) => {
              connectedUser.conversationIds.add(conv.id);
              socket.join(`conversation:${conv.id}`);
            });
          }

          cb({ success: true, conversations: userConversations });
        } catch (error) {
          console.error('[Messaging] Error loading conversations:', error);
          cb({ success: false, error: (error as Error).message });
        }
      });

      // Join conversation
      socket.on('join_conversation', async (conversationId: string, cb) => {
        try {
          // Verify user is part of conversation
          const conv = await db
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.id, conversationId),
                or(
                  eq(conversations.homeownerId, userId),
                  eq(conversations.contractorId, userId)
                )
              )
            )
            .limit(1);

          if (!conv || conv.length === 0) {
            return cb({ success: false, error: 'Not authorized for this conversation' });
          }

          const connectedUser = this.connectedUsers.get(userId);
          if (connectedUser) {
            connectedUser.conversationIds.add(conversationId);
          }

          socket.join(`conversation:${conversationId}`);

          // Load message history
          const messageHistory = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, conversationId))
            .orderBy(messages.createdAt)
            .limit(50);

          cb({ success: true, messages: messageHistory });
        } catch (error) {
          console.error('[Messaging] Error joining conversation:', error);
          cb({ success: false, error: (error as Error).message });
        }
      });

      // Send message
      socket.on('send_message', async (data, cb) => {
        try {
          const { conversationId, content, messageType = 'text', metadata } = data;

          // Verify user is part of conversation
          const conv = await db
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.id, conversationId),
                or(
                  eq(conversations.homeownerId, userId),
                  eq(conversations.contractorId, userId)
                )
              )
            )
            .limit(1);

          if (!conv || conv.length === 0) {
            return cb({ success: false, error: 'Not authorized for this conversation' });
          }

          // Determine sender type
          const senderType = conv[0].homeownerId === userId ? 'homeowner' : 'contractor';

          // Create message
          const messageId = uuidv4();
          const newMessage = await db.insert(messages).values({
            id: messageId,
            conversationId,
            senderId: userId,
            senderType,
            content,
            messageType,
            metadata: metadata ? JSON.stringify(metadata) : null,
            createdAt: new Date(),
          } as any);

          // Update conversation's last message timestamp
          await db
            .update(conversations)
            .set({ lastMessageAt: new Date() })
            .where(eq(conversations.id, conversationId));

          // Broadcast message to conversation participants
          const messageData = {
            id: messageId,
            conversationId,
            senderId: userId,
            senderType,
            content,
            messageType,
            metadata,
            createdAt: new Date(),
            readAt: null,
          };

          this.io.to(`conversation:${conversationId}`).emit('new_message', messageData);

          // Emit notification to other user
          const otherUserId = conv[0].homeownerId === userId
            ? conv[0].contractorId
            : conv[0].homeownerId;

          const otherUserConnection = this.connectedUsers.get(otherUserId);
          if (otherUserConnection) {
            otherUserConnection.socket.emit('message_notification', {
              conversationId,
              senderId: userId,
              senderType,
              message: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
              createdAt: new Date(),
            });
          }

          cb({ success: true, message: messageData });
        } catch (error) {
          console.error('[Messaging] Error sending message:', error);
          cb({ success: false, error: (error as Error).message });
        }
      });

      // Mark message as read
      socket.on('mark_read', async (messageId: string, cb) => {
        try {
          await db
            .update(messages)
            .set({ readAt: new Date() })
            .where(eq(messages.id, messageId));

          // Broadcast read receipt
          const message = await db
            .select()
            .from(messages)
            .where(eq(messages.id, messageId))
            .limit(1);

          if (message && message.length > 0) {
            this.io.to(`conversation:${message[0].conversationId}`).emit('message_read', {
              messageId,
              readAt: new Date(),
            });
          }

          cb({ success: true });
        } catch (error) {
          console.error('[Messaging] Error marking read:', error);
          cb({ success: false, error: (error as Error).message });
        }
      });

      // Typing indicator
      socket.on('typing', (conversationId: string) => {
        socket.broadcast.to(`conversation:${conversationId}`).emit('user_typing', {
          userId,
          conversationId,
        });
      });

      // Stop typing
      socket.on('stop_typing', (conversationId: string) => {
        socket.broadcast.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
          userId,
          conversationId,
        });
      });

      // Disconnect
      socket.on('disconnect', () => {
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
        status: 'active',
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
      console.error('[Messaging] Error creating conversation:', error);
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

// Helper to manage Socket.io service globally
let messagingService: MessagingService | null = null;

export function initializeMessagingService(httpServer: HTTPServer): MessagingService {
  messagingService = new MessagingService(httpServer);
  return messagingService;
}

export function getMessagingService(): MessagingService {
  if (!messagingService) {
    throw new Error('Messaging service not initialized');
  }
  return messagingService;
}
