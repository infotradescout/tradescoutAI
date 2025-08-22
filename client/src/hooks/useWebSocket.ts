import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './useAuth';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const { user } = useAuth();
  const ws = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageHandlers = useRef<Map<string, (data: any) => void>>(new Map());

  const connect = useCallback(() => {
    // WebSocket connections disabled to prevent console errors
    console.log('WebSocket connection disabled');
  }, []);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
      setIsConnected(false);
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    // WebSocket sending disabled
  }, []);

  const subscribe = useCallback((messageType: string, handler: (data: any) => void) => {
    messageHandlers.current.set(messageType, handler);
    return () => {
      messageHandlers.current.delete(messageType);
    };
  }, []);

  useEffect(() => {
    // WebSocket connections disabled to prevent console errors
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    error,
    sendMessage,
    subscribe,
    connect,
    disconnect
  };
}