// WebSocket client disabled to prevent console errors during development

class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  constructor() {
    // WebSocket connections disabled to prevent browser console errors
  }

  private connect() {
    // Disabled to prevent console errors
  }

  private handleReconnect() {
    // Disabled
  }

  public send(message: any) {
    // WebSocket sending disabled
  }

  public on(messageType: string, handler: (data: any) => void) {
    this.messageHandlers.set(messageType, handler);
  }

  public off(messageType: string) {
    this.messageHandlers.delete(messageType);
  }

  public disconnect() {
    // Disabled
  }
}

// Export singleton instance (disabled)
export const websocketClient = new WebSocketClient();