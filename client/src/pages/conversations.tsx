import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { 
  MessageCircle, 
  Send, 
  Eye, 
  User, 
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  Star,
  Package,
  ArrowLeft,
  Plus
} from "lucide-react";
import type { MarketplaceConversation, MarketplaceMessage, MarketplaceListing } from "@shared/schema";

interface ConversationWithDetails extends MarketplaceConversation {
  listing: MarketplaceListing;
  buyer: { id: string; firstName?: string; lastName?: string; profileImageUrl?: string; };
  seller: { id: string; firstName?: string; lastName?: string; profileImageUrl?: string; };
  lastMessage?: MarketplaceMessage;
  unreadCount: number;
}

export default function Conversations() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");

  // Fetch user's conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery<ConversationWithDetails[]>({
    queryKey: ["/api/marketplace/conversations"],
    enabled: isAuthenticated,
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery<MarketplaceMessage[]>({
    queryKey: ["/api/marketplace/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { conversationId: string; content: string; messageType?: string }) =>
      apiRequest("POST", `/api/marketplace/conversations/${data.conversationId}/messages`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/conversations"] });
      if (selectedConversation) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/marketplace/conversations", selectedConversation, "messages"] 
        });
      }
      setNewMessage("");
      toast({
        title: "Message sent",
        description: "Your message has been delivered",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  // Mark conversation as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (conversationId: string) =>
      apiRequest("PUT", `/api/marketplace/conversations/${conversationId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/conversations"] });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !newMessage.trim()) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation,
      content: newMessage.trim(),
      messageType: "text"
    });
  };

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    markAsReadMutation.mutate(conversationId);
  };

  const getOtherParticipant = (conversation: ConversationWithDetails) => {
    return user?.id === conversation.buyerId ? conversation.seller : conversation.buyer;
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  const selectedConversationData = conversations.find(c => c.id === selectedConversation);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Sign in to view conversations</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Connect with buyers and sellers to discuss your marketplace items
            </p>
            <Link href="/login">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419]">
      <div className="max-w-7xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-orange-500 mb-2">
            Your Conversations
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect with other TradeScout members about marketplace items
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Conversations List */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Conversations
                  {conversations.length > 0 && (
                    <Badge variant="secondary">{conversations.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-300px)]">
                  {loadingConversations ? (
                    <div className="p-4 space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                            <div className="flex-1">
                              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="p-6 text-center">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="font-medium text-orange-500 mb-2">
                        No conversations yet
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Start browsing the Exchange to connect with other members
                      </p>
                      <Link href="/exchange">
                        <Button size="sm">
                          <Package className="h-4 w-4 mr-2" />
                          Browse Exchange
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((conversation) => {
                        const otherParticipant = getOtherParticipant(conversation);
                        const isUnread = conversation.unreadCount > 0;
                        
                        return (
                          <div
                            key={conversation.id}
                            onClick={() => handleSelectConversation(conversation.id)}
                            className={`p-4 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 hover:bg-[#0f1419] dark:hover:bg-[#1a2332] ${
                              selectedConversation === conversation.id 
                                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' 
                                : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <Avatar className="w-12 h-12">
                                <AvatarImage src={otherParticipant.profileImageUrl} />
                                <AvatarFallback>
                                  {(otherParticipant.firstName?.[0] || '') + (otherParticipant.lastName?.[0] || '')}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className={`font-medium truncate ${isUnread ? 'text-orange-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {otherParticipant.firstName} {otherParticipant.lastName}
                                  </h4>
                                  {isUnread && (
                                    <Badge variant="destructive" className="ml-2 text-xs">
                                      {conversation.unreadCount}
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
                                  {conversation.listing.title}
                                </p>
                                
                                {conversation.lastMessage && (
                                  <p className={`text-xs truncate ${isUnread ? 'font-medium text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'}`}>
                                    {conversation.lastMessage.content}
                                  </p>
                                )}
                                
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-gray-500">
                                    {formatMessageTime(conversation.lastMessageAt?.toString() || conversation.createdAt?.toString() || '')}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    ${conversation.listing.price}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Selected Conversation */}
          <div className="lg:col-span-2">
            {selectedConversation && selectedConversationData ? (
              <Card className="h-full flex flex-col">
                <CardHeader className="border-b border-[#2d3748]">
                  <div className="flex items-center gap-4">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedConversation(null)}
                      className="lg:hidden"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={getOtherParticipant(selectedConversationData).profileImageUrl} />
                      <AvatarFallback>
                        {(getOtherParticipant(selectedConversationData).firstName?.[0] || '') + 
                         (getOtherParticipant(selectedConversationData).lastName?.[0] || '')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-orange-500">
                        {getOtherParticipant(selectedConversationData).firstName} {getOtherParticipant(selectedConversationData).lastName}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        About: {selectedConversationData.listing.title}
                      </p>
                    </div>
                    
                    <Link href={`/marketplace/listing/${selectedConversationData.listing.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View Item
                      </Button>
                    </Link>
                  </div>
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 p-0 overflow-hidden">
                  <ScrollArea className="h-[calc(100vh-400px)] p-4">
                    {loadingMessages ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => {
                          const isOwn = message.senderId === user?.id;
                          
                          return (
                            <div
                              key={message.id}
                              className={`flex items-start gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                            >
                              <Avatar className="w-8 h-8">
                                <AvatarImage 
                                  src={isOwn 
                                    ? user?.profileImageUrl 
                                    : getOtherParticipant(selectedConversationData).profileImageUrl
                                  } 
                                />
                                <AvatarFallback className="text-xs">
                                  {isOwn 
                                    ? (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')
                                    : (getOtherParticipant(selectedConversationData).firstName?.[0] || '') + 
                                      (getOtherParticipant(selectedConversationData).lastName?.[0] || '')
                                  }
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className={`flex-1 max-w-xs lg:max-w-md ${isOwn ? 'text-right' : ''}`}>
                                <div className={`inline-block p-3 rounded-lg ${
                                  isOwn 
                                    ? 'bg-orange-600 text-white' 
                                    : 'bg-[#0f1419] dark:bg-[#1a2332] text-orange-500'
                                }`}>
                                  <p className="text-sm">{message.content}</p>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {formatMessageTime(message.createdAt?.toString() || '')}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>

                {/* Message Input */}
                <div className="border-t border-[#2d3748] p-4">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1"
                      disabled={sendMessageMutation.isPending}
                    />
                    <Button 
                      type="submit" 
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold text-orange-500 mb-2">
                    Select a conversation
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Choose a conversation from the list to start messaging
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}