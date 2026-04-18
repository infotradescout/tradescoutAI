// WebSocket client for real-time communication
import { getApiBaseUrl } from "@/lib/apiBaseUrl";

class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor() {
    // Completely disable WebSocket connections in development
    // Only enable in true production environments
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV === "production" &&
      window.location.protocol === "https:" &&
      !window.location.hostname.includes("localhost") &&
      !window.location.hostname.includes("127.0.0.1") &&
      !window.location.hostname.includes(".replit.dev") &&
      !window.location.hostname.includes(".replit.")
    ) {
      this.connect();
    }
  }

  private connect() {
    try {
      const apiBaseUrl = getApiBaseUrl() || window.location.origin;
      const apiOrigin = new URL(apiBaseUrl, window.location.origin);
      const protocol = apiOrigin.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${apiOrigin.host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0; // Reset on successful connection
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const handler = this.messageHandlers.get(message.type);
          if (handler) {
            handler(message);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.log("WebSocket connection error - will retry if needed");
      };
    } catch (error) {
      console.log("WebSocket not available - continuing without real-time features");
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      setTimeout(() => {
        console.log(
          `Attempting WebSocket reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.connect();
      }, delay);
    }
  }

  public send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public on(messageType: string, handler: (data: any) => void) {
    this.messageHandlers.set(messageType, handler);
  }

  public off(messageType: string) {
    this.messageHandlers.delete(messageType);
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export singleton instance
export const websocketClient = new WebSocketClient();
