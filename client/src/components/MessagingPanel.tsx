import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMessaging } from '@/hooks/useMessaging';
import { formatDistanceToNow } from 'date-fns';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessagingPanelProps {
  userId: string;
  conversationId?: string;
  onClose?: () => void;
}

export function MessagingPanel({
  userId,
  conversationId,
  onClose,
}: MessagingPanelProps) {
  const {
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
  } = useMessaging(userId);

  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Auto-join conversation if provided
  useEffect(() => {
    if (conversationId && isConnected) {
      joinConversation(conversationId);
    }
  }, [conversationId, isConnected, joinConversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when viewed
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.senderId !== userId && !msg.readAt) {
        markAsRead(msg.id);
      }
    });
  }, [messages, userId, markAsRead]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !currentConversation || isSending) return;

    setIsSending(true);
    notifyStoppedTyping();

    try {
      await sendMessage(messageInput, 'text');
      setMessageInput('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);

    // Notify typing
    notifyTyping();

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      notifyStoppedTyping();
    }, 3000);
  };

  const handleConversationSelect = (conversationId: string) => {
    setCurrentConversation(conversationId);
    joinConversation(conversationId);
  };

  const getOtherParticipant = (conversation: any) => {
    return conversation.homeownerId === userId
      ? `Contractor #${conversation.contractorId.substring(0, 8)}`
      : `Homeowner #${conversation.homeownerId.substring(0, 8)}`;
  };

  if (!isConnected) {
    return (
      <Card className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          {error ? (
            <>
              <MessageCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
              <p className="text-red-600 font-medium">{error}</p>
            </>
          ) : (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-gray-400 mb-4 animate-spin" />
              <p className="text-gray-500">Connecting to messaging service...</p>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="h-full flex gap-4">
      {/* Conversations List */}
      <div className="w-80 border rounded-lg flex flex-col bg-white">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Conversations</h2>
          {isLoading && !conversations.length && (
            <p className="text-xs text-gray-500 mt-2">Loading...</p>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationSelect(conversation.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-colors',
                    currentConversation === conversation.id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'hover:bg-gray-100'
                  )}
                >
                  <div className="font-medium text-sm">
                    {getOtherParticipant(conversation)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Last message:{' '}
                    {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                      addSuffix: true,
                    })}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 border rounded-lg flex flex-col bg-white">
        {currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">
                {conversations.find((c) => c.id === currentConversation)
                  ? getOtherParticipant(
                      conversations.find((c) => c.id === currentConversation)!
                    )
                  : 'Conversation'}
              </h3>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-2',
                        message.senderId === userId ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-xs px-4 py-2 rounded-lg',
                          message.senderId === userId
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-900'
                        )}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p
                          className={cn(
                            'text-xs mt-1',
                            message.senderId === userId
                              ? 'text-blue-100'
                              : 'text-gray-600'
                          )}
                        >
                          {formatDistanceToNow(new Date(message.createdAt), {
                            addSuffix: true,
                          })}
                          {message.readAt && ' ✓✓'}
                        </p>
                      </div>
                    </div>
                  ))
                )}

                {/* Typing Indicator */}
                {typingUsers.size > 0 && (
                  <div className="flex gap-2 items-center text-gray-500">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                    </div>
                    <span className="text-xs">
                      {Array.from(typingUsers).length} typing...
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t flex gap-2">
              <Input
                value={messageInput}
                onChange={handleMessageInputChange}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                disabled={isSending}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || isSending}
                size="sm"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
