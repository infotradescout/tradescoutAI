import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';
import { db } from '../src/db/drizzle-mock';
import { messages } from '@shared/schema';

interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
}

// In-memory store for rooms and their associated clients
const rooms: Map<string, Set<WebSocket>> = new Map();

class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      verifyClient: (info: any) => {
        // Only allow connections in production environments
        const isDevelopment = process.env.NODE_ENV !== 'production';
        if (isDevelopment) {
          return false; // Block all WebSocket connections in development
        }
        return true;
      },
      // Handle protocols properly
      handleProtocols: (protocols: Set<string>) => {
        return protocols.size > 0 ? Array.from(protocols)[0] : '';
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    console.log('WebSocket server initialized on /ws');
  }

  private handleConnection(ws: WebSocket, request: any) {
    const clientId = this.generateClientId();
    const client: WebSocketClient = { ws };

    this.clients.set(clientId, client);
    console.log(`WebSocket client connected: ${clientId}`);

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(clientId, message);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        // Send error response to client
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Failed to process message'
        });
      }
    });

    // Handle client disconnect
    ws.on('close', (code, reason) => {
      this.clients.delete(clientId);
      // Remove client from any rooms they were in
      rooms.forEach((clientsInRoom, roomId) => {
        clientsInRoom.delete(ws);
        if (clientsInRoom.size === 0) {
          rooms.delete(roomId);
        }
      });
      console.log(`WebSocket client disconnected: ${clientId}, code: ${code}, reason: ${reason}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.clients.delete(clientId);
      // Remove client from any rooms they were in
      rooms.forEach((clientsInRoom, roomId) => {
        clientsInRoom.delete(ws);
        if (clientsInRoom.size === 0) {
          rooms.delete(roomId);
        }
      });
    });

    // Send initial connection confirmation
    this.sendToClient(clientId, {
      type: 'connection_established',
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  private async handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'authenticate':
        // Authenticate user and associate with WebSocket
        client.userId = message.userId;
        client.sessionId = message.sessionId;

        // Send unread notification count
        if (client.userId) {
          const notifications = await storage.getUserNotifications(client.userId, true);
          this.sendToClient(clientId, {
            type: 'notification_count',
            count: notifications.length
          });
        }
        break;

      case 'ping':
        this.sendToClient(clientId, { type: 'pong' });
        break;

      case 'join_conversation':
        // Join a conversation room for real-time messages
        client.conversationId = message.conversationId;
        const roomId = `conversation_${message.conversationId}`;
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }
        rooms.get(roomId)!.add(client.ws);
        break;

      case 'leave_conversation':
        // Leave conversation room
        const leaveRoomId = `conversation_${client.conversationId}`;
        if (rooms.has(leaveRoomId)) {
          rooms.get(leaveRoomId)!.delete(client.ws);
          if (rooms.get(leaveRoomId)!.size === 0) {
            rooms.delete(leaveRoomId);
          }
        }
        delete client.conversationId;
        break;

      case 'chat_message':
        // Handle chat messages
        handleChatMessage(client.ws, message);
        break;

      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }

  private sendToClient(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  // Public methods for sending notifications
  public async sendNotificationToUser(userId: string, notification: any) {
    const userClients = Array.from(this.clients.entries())
      .filter(([_, client]) => client.userId === userId);

    for (const [clientId, client] of userClients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, {
          type: 'new_notification',
          notification
        });
      }
    }
  }

  public async sendMessageToConversation(conversationId: string, message: any) {
    const roomId = `conversation_${conversationId}`;
    broadcastToRoom(roomId, {
      type: 'new_message',
      message,
      timestamp: new Date()
    });
  }

  public async sendTransactionUpdate(userId: string, transaction: any) {
    const userClients = Array.from(this.clients.entries())
      .filter(([_, client]) => client.userId === userId);

    for (const [clientId, client] of userClients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, {
          type: 'transaction_update',
          transaction
        });
      }
    }
  }

  public async broadcastListingUpdate(listing: any) {
    // Broadcast to all connected clients about new listings
    for (const [clientId, client] of Array.from(this.clients.entries())) {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, {
          type: 'listing_update',
          listing
        });
      }
    }
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  // Get connected users count
  public getConnectedUsersCount(): number {
    return Array.from(this.clients.values())
      .filter(client => client.userId).length;
  }

  // Get online status for a user
  public isUserOnline(userId: string): boolean {
    return Array.from(this.clients.values())
      .some(client => client.userId === userId && client.ws.readyState === WebSocket.OPEN);
  }
}

export { WebSocketManager };

// Helper function to broadcast messages to a specific room
export const broadcastToRoom = (roomId: string, message: any) => {
  if (rooms.has(roomId)) {
    const clients = rooms.get(roomId)!;
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
};

// Handler for incoming chat messages
export const handleChatMessage = async (ws: WebSocket, data: any) => {
  const { conversationId, message, senderId } = data;

  // Store message in database
  try {
    if ((db as any).query?.messages?.insert) {
      await db.insert(messages).values({
        conversationId,
        senderId,
        content: message,
        createdAt: new Date(),
        read: false,
      });
      console.log(`Message stored in database for conversation ${conversationId}`);
    } else {
      console.log(`Mock mode: Message from ${senderId} in conversation ${conversationId}: ${message}`);
    }
  } catch (error) {
    console.error('Error storing message:', error);
  }

  // Broadcast to conversation participants
  broadcastToRoom(`conversation_${conversationId}`, {
    type: 'new_message',
    message,
    senderId,
    timestamp: new Date()
  });
};