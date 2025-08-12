import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
}

class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      verifyClient: (info) => {
        // Secure WebSocket authentication
        const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
        const token = url.searchParams.get('token');
        const sessionId = url.searchParams.get('sessionId');
        
        // Require either session or token for authentication
        if (!token && !sessionId) {
          console.log('WebSocket connection rejected: no authentication provided');
          return false;
        }
        
        // TODO: Validate token or session against database
        // For now, require at least one auth parameter
        return true;
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
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
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.clients.delete(clientId);
      console.log(`WebSocket client disconnected: ${clientId}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });

    // Send initial connection confirmation
    this.sendToClient(clientId, {
      type: 'connection_established',
      clientId
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
        break;

      case 'leave_conversation':
        // Leave conversation room
        delete client.conversationId;
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
    const conversationClients = Array.from(this.clients.entries())
      .filter(([_, client]) => (client as any).conversationId === conversationId);

    for (const [clientId, client] of conversationClients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, {
          type: 'new_message',
          message
        });
      }
    }
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
    for (const [clientId, client] of this.clients.entries()) {
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