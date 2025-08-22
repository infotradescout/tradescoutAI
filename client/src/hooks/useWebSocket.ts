import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './useAuth';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const { user } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());

  const connect = useCallback(() => {
    try {
      // Only connect in production or when explicitly needed for development
      if (process.env.NODE_ENV === 'development') {
        console.log('WebSocket connection available but optional in development');
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        
        // Authenticate if user is logged in
        if (user) {
          ws.current?.send(JSON.stringify({
            type: 'authenticate',
            userId: user.id,
            sessionId: Date.now().toString()
          }));
        }
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          const handler = messageHandlers.current.get(message.type);
          if (handler) {
            handler(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
      };

      ws.current.onerror = (error) => {
        setError('WebSocket connection failed');
        setIsConnected(false);
      };

    } catch (error) {
      setError('Failed to create WebSocket connection');
      console.error('WebSocket connection error:', error);
    }
  }, [user]);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
      setIsConnected(false);
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback((messageType: string, handler: (data: any) => void) => {
    messageHandlers.current.set(messageType, handler);
    return () => {
      messageHandlers.current.delete(messageType);
    };
  }, []);

  useEffect(() => {
    // Auto-connect is optional in development, required in production
    if (process.env.NODE_ENV === 'production') {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    error,
    sendMessage,
    subscribe,
    connect,
    disconnect
  };
}