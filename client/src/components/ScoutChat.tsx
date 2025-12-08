import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Send, MessageCircle, X, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ScoutResponse {
  message: string;
  actions?: any[];
  actionResults?: any[];
  timestamp: string;
}

type ScoutChatProps = {
  defaultOpen?: boolean;
  isAuthenticated?: boolean;
};

const INTRO_PROMPT = "What can TradeScout do for my community?";

export function ScoutChat({ defaultOpen = false, isAuthenticated = false }: ScoutChatProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const autoRunTimeoutRef = useRef<number | null>(null);
  const hasAutoRunRef = useRef(false);
  const userInteractedRef = useRef(false);
  const [, navigate] = useLocation();

  const isGuest = !isAuthenticated;
  const floatingPosition: React.CSSProperties = {
    right: '1rem',
    bottom: 'clamp(24px, calc(env(safe-area-inset-bottom, 0px) + 32px), 96px)',
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Seed intro + auto-run prompt (cancellable on interaction)
  useEffect(() => {
    const hasSeenIntro = localStorage.getItem('ts_seen_intro_prompt') === 'true';

    if (messagesRef.current.length === 0) {
      const introMessage: Message = {
        role: 'assistant',
        content: isAuthenticated
          ? "Welcome back! I'm Scout, your TradeScout operating system. I can:\n• Find and message verified contractors for your county\n• Spin up Community Builder and launch outreach posts\n• Search marketplace deals or list your gear fast\n• Run MealScout to surface food trucks and local offers\nAsk me anything specific (project, location, budget, timing) and I'll act immediately."
          : "Hey, I'm Scout—your TradeScout guide. I can: find local pros, search marketplace deals, launch community growth, and run MealScout. Tell me your project or pick a prompt below and I'll get it done.",
        timestamp: new Date(),
      };

      setMessages([introMessage]);
      messagesRef.current = [introMessage];

      if (!hasSeenIntro) {
        setInputValue(INTRO_PROMPT);
        autoRunTimeoutRef.current = window.setTimeout(() => {
          if (userInteractedRef.current || hasAutoRunRef.current) return;
          hasAutoRunRef.current = true;
          handleSendMessage(INTRO_PROMPT);
        }, 1200);
      }
    }

    return () => {
      if (autoRunTimeoutRef.current) {
        window.clearTimeout(autoRunTimeoutRef.current);
      }
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const userHasSent = messages.some((m) => m.role === 'user');
    if (userHasSent) {
      localStorage.setItem('ts_seen_intro_prompt', 'true');
    }
  }, [messages]);

  const markUserInteracted = () => {
    if (!userInteractedRef.current) {
      userInteractedRef.current = true;
    }
    if (autoRunTimeoutRef.current) {
      window.clearTimeout(autoRunTimeoutRef.current);
      autoRunTimeoutRef.current = null;
    }
  };

  const handleSendMessage = async (prompt?: string) => {
    const messageToSend = (prompt ?? inputValue).trim();
    if (!messageToSend || isLoading || isGuest) return;

    markUserInteracted();

    const isFirstUserTurn = !messagesRef.current.some((m) => m.role === 'user');

    const userMessage: Message = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => {
      const next = [...prev, userMessage];
      messagesRef.current = next;
      return next;
    });
    if (!prompt) setInputValue('');
    setIsLoading(true);

    try {
      // Send message to backend
      const response = await fetch('/api/scout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: messageToSend,
          history: messagesRef.current.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Scout');
      }

      const data: ScoutResponse = await response.json();

      // Add Scout response to messages
      const scoutMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(data.timestamp),
      };

      setMessages((prev) => {
        const next = [...prev, scoutMessage];
        messagesRef.current = next;
        return next;
      });

      // If there are action results, add them as a follow-up message
      if (data.actionResults && data.actionResults.length > 0) {
        const resultsMessage: Message = {
          role: 'assistant',
          content: formatActionResults(data.actionResults),
          timestamp: new Date(data.timestamp),
        };
        setMessages((prev) => {
          const next = [...prev, resultsMessage];
          messagesRef.current = next;
          return next;
        });
      }

      // Flashier first-response booster: echo intent + service highlights
      if (isFirstUserTurn) {
        const highlight: Message = {
          role: 'assistant',
          content: `Got it — '${messageToSend}'. Here's how I can move fast right now:\n• Contractors: I can find and message verified pros in your county.\n• Marketplace: Surface deals or list your gear with price recommendations.\n• Community Builder: Launch outreach posts and welcome messages.\n• MealScout: Pull nearby food trucks, restaurants, and offers.\nWant me to execute one of these or refine your request?` ,
          timestamp: new Date(),
        };
        setMessages((prev) => {
          const next = [...prev, highlight];
          messagesRef.current = next;
          return next;
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, Scout hit an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const next = [...prev, errorMessage];
        messagesRef.current = next;
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatActionResults = (results: any[]): string => {
    let formatted = '\n\n**Results:**\n\n';
    
    results.forEach((result) => {
      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          formatted += `Found ${result.data.length} items:\n`;
          result.data.slice(0, 3).forEach((item: any, index: number) => {
            formatted += `${index + 1}. ${JSON.stringify(item, null, 2)}\n`;
          });
          if (result.data.length > 3) {
            formatted += `... and ${result.data.length - 3} more\n`;
          }
        } else {
          formatted += `${JSON.stringify(result.data, null, 2)}\n`;
        }
      } else if (result.error) {
        formatted += `Error: ${result.error}\n`;
      }
    });

    return formatted;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    markUserInteracted();
    setInputValue(prompt);
    handleSendMessage(prompt);
  };

  const quickPrompts = [
    'Find roofers available this week',
    'Start the Community Builder for my county',
    'Show me today\'s best tool deals',
    'Message the top 3 electricians near me',
    'Create a project for kitchen remodel',
    'List my pressure washer for $250',
    'Find food trucks near me tonight',
  ];

  const navButtons = [
    { label: 'Open Dashboard', path: '/dashboard' },
    { label: 'Browse Contractors', path: '/contractors' },
    { label: 'Marketplace', path: '/marketplace' },
    { label: 'Community Builder', path: '/community' },
    { label: 'MealScout', path: '/mealscout' },
    { label: 'Help Center', path: '/help' },
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        style={floatingPosition}
        className="fixed z-50 rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card 
      style={floatingPosition}
      className={`fixed z-50 shadow-2xl transition-all ${
        isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary text-primary-foreground rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <h3 className="font-semibold">TradeScout Scout</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-8 w-8 hover:bg-primary-foreground/20"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 hover:bg-primary-foreground/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      {!isMinimized && (
        <>
          <ScrollArea className="flex-1 h-[480px] p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t space-y-3">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {navButtons.map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    markUserInteracted();
                    navigate(item.path);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={markUserInteracted}
              placeholder={
                isGuest
                  ? "Sign in to chat with Scout"
                  : "Ask anything about contractors, marketplace, or your account..."
              }
              className="w-full border rounded-lg p-2 min-h-[80px] resize-none"
              disabled={isLoading || isGuest}
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                className="flex-1"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputValue.trim() || isGuest}
              >
                {isLoading ? 'Working...' : 'Send'}
                <Send className="h-4 w-4 ml-2" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/help')}
              >
                Help
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
