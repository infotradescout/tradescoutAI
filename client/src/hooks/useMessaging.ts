import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'homeowner' | 'contractor';
  content: string;
  messageType: 'text' | 'quote' | 'schedule' | 'materials' | 'image';
  metadata?: Record<string, any>;
  createdAt: Date;
  readAt?: Date;
}

interface Conversation {
  id: string;
  homeownerId: string;
  contractorId: string;
  status: 'active' | 'closed' | 'archived';
  lastMessageAt: Date;
  homeownerRating?: number;
  contractorRating?: number;
  homeownerFeedback?: string;
  contractorFeedback?: string;
}

export function useMessaging(userId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  // Initialize socket connection
  useEffect(() => {
    if (!userId) return;

    // In Vite, env vars are exposed via import.meta.env
    const devPort = (import.meta.env.VITE_SERVER_PORT as string) || "5000";

    const socketUrl = import.meta.env.PROD
      ? window.location.origin
      : `http://localhost:${devPort}`;

    const newSocket: Socket = io(socketUrl, {
      auth: {
        userId,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[Messaging] Connected to server');
      setIsConnected(true);
      reconnectAttempts.current = 0;
      setError(null);
    });

    newSocket.on('disconnect', () => {
      console.log('[Messaging] Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error: any) => {
      console.error('[Messaging] Connection error:', error);
      reconnectAttempts.current++;
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        setError('Unable to connect to messaging service. Please refresh the page.');
      }
    });

    newSocket.on('new_message', (message: Message) => {
      console.log('[Messaging] New message received:', message);
      setMessages((prev) => [...prev, message]);
    });

    newSocket.on('message_read', (data: { messageId: string; readAt: Date }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, readAt: new Date(data.readAt) }
            : msg
        )
      );
    });

    newSocket.on('user_typing', (data: { userId: string; conversationId: string }) => {
      if (data.conversationId === currentConversation) {
        setTypingUsers((prev) => {
          const updated = new Set(prev);
          updated.add(data.userId);
          return updated;
        });
      }
    });

    newSocket.on('user_stopped_typing', (data: { userId: string; conversationId: string }) => {
      if (data.conversationId === currentConversation) {
        setTypingUsers((prev) => {
          const updated = new Set(prev);
          updated.delete(data.userId);
          return updated;
        });
      }
    });

    newSocket.on('message_notification', (data: any) => {
      console.log('[Messaging] Message notification:', data);
      // Could trigger notification here
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!socket) return;

    setIsLoading(true);
    try {
      socket.emit('load_conversations', (response: any) => {
        if (response.success) {
          setConversations(response.conversations);
          setError(null);
        } else {
          setError(response.error);
        }
        setIsLoading(false);
      });
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  }, [socket]);

  // Join conversation
  const joinConversation = useCallback(
    async (conversationId: string) => {
      if (!socket) return;

      setCurrentConversation(conversationId);
      setIsLoading(true);
      try {
        socket.emit('join_conversation', conversationId, (response: any) => {
          if (response.success) {
            setMessages(response.messages);
            setError(null);
          } else {
            setError(response.error);
          }
          setIsLoading(false);
        });
      } catch (err) {
        setError((err as Error).message);
        setIsLoading(false);
      }
    },
    [socket]
  );

  // Send message
  const sendMessage = useCallback(
    async (content: string, messageType: string = 'text', metadata?: Record<string, any>) => {
      if (!socket || !currentConversation) {
        setError('No active conversation');
        return;
      }

      try {
        socket.emit(
          'send_message',
          {
            conversationId: currentConversation,
            content,
            messageType,
            metadata,
          },
          (response: any) => {
            if (!response.success) {
              setError(response.error);
            } else {
              setError(null);
            }
          }
        );
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [socket, currentConversation]
  );

  // Mark message as read
  const markAsRead = useCallback(
    (messageId: string) => {
      if (!socket) return;

      socket.emit('mark_read', messageId, (response: any) => {
        if (!response.success) {
          console.error('[Messaging] Error marking read:', response.error);
        }
      });
    },
    [socket]
  );

  // Send typing indicator
  const notifyTyping = useCallback(() => {
    if (!socket || !currentConversation) return;
    socket.emit('typing', currentConversation);
  }, [socket, currentConversation]);

  // Stop typing indicator
  const notifyStoppedTyping = useCallback(() => {
    if (!socket || !currentConversation) return;
    socket.emit('stop_typing', currentConversation);
  }, [socket, currentConversation]);

  return {
    socket,
    isConnected,
    isLoading,
    error,
    conversations,
    currentConversation,
    messages,
    typingUsers,
    loadConversations,
    joinConversation,
    sendMessage,
    markAsRead,
    notifyTyping,
    notifyStoppedTyping,
    setCurrentConversation,
  };
}
