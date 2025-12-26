import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageCircle, 
  Send, 
  Star, 
  Calendar, 
  DollarSign, 
  ShoppingCart,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  User,
  Building2,
  Phone,
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { MaterialListBuilder } from "@/components/MaterialListBuilder";

interface Conversation {
  id: string;
  homeownerId: string;
  contractorId: string;
  status: string;
  lastMessageAt: string;
  homeownerRating?: number;
  contractorRating?: number;
  homeownerFeedback?: string;
  contractorFeedback?: string;
  createdAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'homeowner' | 'contractor';
  content: string;
  messageType: 'text' | 'quote' | 'schedule' | 'materials' | 'image';
  metadata?: any;
  readAt?: string;
  createdAt: string;
}

interface Quote {
  id: string;
  title: string;
  description: string;
  laborCost: string;
  materialCost: string;
  totalCost: string;
  validUntil: string;
  status: string;
  terms: string;
  createdAt: string;
}

interface Schedule {
  id: string;
  title: string;
  description: string;
  proposedDate: string;
  duration: number;
  status: string;
  location: string;
  notes: string;
  createdAt: string;
}

interface MaterialList {
  id: string;
  title: string;
  description: string;
  items: Array<{
    name: string;
    quantity: number;
    estimatedCost: number;
    vendor?: string;
    sku?: string;
  }>;
  totalEstimatedCost: string;
  vendorInfo?: any;
  status: string;
  createdAt: string;
}

export default function Chat() {
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();
  const [match, params] = useRoute("/chat/:conversationId?");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newMessage, setNewMessage] = useState("");
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showMaterialsDialog, setShowMaterialsDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const conversationId = params?.conversationId;

  // Fetch conversations list
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    enabled: isAuthenticated,
  });

  // Fetch current conversation
  const { data: currentConversation } = useQuery({
    queryKey: ["/api/conversations", conversationId],
    enabled: isAuthenticated && !!conversationId,
  });

  // Fetch messages for current conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: isAuthenticated && !!conversationId,
    refetchInterval: 3000, // Poll for new messages every 3 seconds
  });

  // Fetch quotes for current conversation
  const { data: quotes = [] } = useQuery({
    queryKey: ["/api/conversations", conversationId, "quotes"],
    enabled: isAuthenticated && !!conversationId,
  });

  // Fetch schedules for current conversation
  const { data: schedules = [] } = useQuery({
    queryKey: ["/api/conversations", conversationId, "schedules"],
    enabled: isAuthenticated && !!conversationId,
  });

  // Fetch material lists for current conversation
  const { data: materialLists = [] } = useQuery<MaterialList[]>({
    queryKey: ["/api/conversations", conversationId, "material-lists"],
    enabled: isAuthenticated && !!conversationId,
    placeholderData: [] as MaterialList[],
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/messages`, messageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
      setNewMessage("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Rate conversation mutation
  const rateConversationMutation = useMutation({
    mutationFn: async (ratingData: { rating: number; feedback: string }) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/rate`, ratingData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      setShowRatingDialog(false);
      setRating(5);
      setFeedback("");
      toast({
        title: "Success",
        description: "Thank you for your feedback!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      content: newMessage,
      messageType: "text",
    });
  };

  const handleRateConversation = () => {
    rateConversationMutation.mutate({
      rating,
      feedback,
    });
  };

  const formatMessageTime = (timestamp: string) => {
    return format(new Date(timestamp), "MMM d, h:mm a");
  };

  const renderMessage = (message: Message) => {
    const isOwn = message.senderId === user?.id;
    const senderName = message.senderType === 'homeowner' ? 'Homeowner' : 'Contractor';
    
    return (
      <div
        key={message.id}
        className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-4`}
      >
        <div
          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
            isOwn
              ? "bg-orange-500 text-white"
              : "bg-navy-700 text-white border border-navy-600"
          }`}
        >
          <div className="text-sm opacity-75 mb-1">{senderName}</div>
          <div className="text-sm">{message.content}</div>
          <div className={`text-xs mt-2 opacity-60`}>
            {formatMessageTime(message.createdAt)}
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <Card className="bg-navy-700 border-navy-600 max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <MessageCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Sign In Required</h3>
            <p className="text-gray-300 mb-6">
              Please sign in to access your conversations and chat with contractors.
            </p>
            <Link href="/login">
              <Button className="btn-primary">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-7xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
          
          {/* Conversations Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-navy-700 border-navy-600 h-full">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Conversations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                  {conversations.length === 0 ? (
                    <div className="p-4 text-center">
                      <p className="text-gray-400 text-sm">No conversations yet</p>
                      <p className="text-gray-500 text-xs mt-1">
                        Start a conversation with a contractor from their profile
                      </p>
                    </div>
                  ) : (
                    conversations.map((conversation: Conversation) => (
                      <Link
                        key={conversation.id}
                        href={`/chat/${conversation.id}`}
                      >
                        <div
                          className={`p-4 border-b border-navy-600 hover:bg-navy-600 cursor-pointer transition-colors ${
                            conversationId === conversation.id ? "bg-navy-600" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">
                                Contractor Conversation
                              </p>
                              <p className="text-gray-400 text-xs">
                                {format(new Date(conversation.lastMessageAt), "MMM d, h:mm a")}
                              </p>
                            </div>
                            <Badge
                              variant={conversation.status === "active" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {conversation.status}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            {conversationId ? (
              <div className="h-full flex flex-col">
                
                {/* Chat Header */}
                <Card className="bg-navy-700 border-navy-600 mb-4">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">Contractor Chat</h3>
                          <p className="text-gray-400 text-sm">
                            Status: {(currentConversation as Conversation)?.status || "Active"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRatingDialog(true)}
                          className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                        >
                          <Star className="h-4 w-4 mr-1" />
                          Rate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuoteDialog(true)}
                    className="border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Request Quote
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowScheduleDialog(true)}
                    className="border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                  >
                    <Calendar className="h-4 w-4 mr-1" />
                    Schedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMaterialsDialog(true)}
                    className="border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white"
                  >
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Materials
                  </Button>
                </div>

                {/* Messages Area */}
                <Card className="bg-navy-700 border-navy-600 flex-1 flex flex-col">
                  <CardContent className="p-4 flex-1 flex flex-col">
                    <ScrollArea className="flex-1 pr-4">
                      <div className="space-y-4">
                        {messages.length === 0 ? (
                          <div className="text-center py-8">
                            <MessageCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                            <p className="text-gray-400">No messages yet</p>
                            <p className="text-gray-500 text-sm">Start the conversation!</p>
                          </div>
                        ) : (
                          messages.map(renderMessage)
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    {/* Message Input */}
                    <div className="mt-4 flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="form-field flex-1"
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || sendMessageMutation.isPending}
                        className="btn-primary"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              // No conversation selected
              <Card className="bg-navy-700 border-navy-600 h-full flex items-center justify-center">
                <CardContent className="text-center">
                  <MessageCircle className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Select a Conversation</h3>
                  <p className="text-gray-400">
                    Choose a conversation from the sidebar to start chatting
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Rating Dialog */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent className="bg-navy-700 border-navy-600">
          <DialogHeader>
            <DialogTitle className="text-white">Rate This Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Rating (1-5 stars)
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`p-1 ${
                      star <= rating ? "text-yellow-400" : "text-gray-600"
                    }`}
                  >
                    <Star className="h-6 w-6 fill-current" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Feedback (optional)
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your experience..."
                className="form-field"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowRatingDialog(false)}
                className="border-gray-600 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRateConversation}
                disabled={rateConversationMutation.isPending}
                className="btn-primary"
              >
                Submit Rating
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Materials Dialog */}
      <Dialog open={showMaterialsDialog} onOpenChange={setShowMaterialsDialog}>
        <DialogContent className="bg-navy-700 border-navy-600 max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Material Lists & Collaborative Shopping</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Existing Material Lists */}
            {materialLists.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Existing Material Lists</h3>
                <div className="space-y-4">
                  {materialLists.map((materialList: any) => (
                    <Card key={materialList.id} className="bg-navy-600 border-navy-500">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-white">{materialList.title}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {materialList.status || 'draft'}
                          </Badge>
                        </div>
                        {materialList.description && (
                          <p className="text-gray-400 text-sm">{materialList.description}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Array.isArray(materialList.items) ? materialList.items.map((item: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-navy-700 rounded-lg border border-navy-500">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-white">{item.name}</span>
                                  <Badge 
                                    variant={
                                      item.status === 'approved' ? 'default' : 
                                      item.status === 'denied' ? 'error' : 
                                      'secondary'
                                    }
                                    className="text-xs"
                                  >
                                    {item.status === 'pending' && `Suggested by ${item.suggestedBy}`}
                                    {item.status === 'approved' && 'Approved'}
                                    {item.status === 'denied' && 'Denied'}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-400">
                                  Qty: {item.quantity} | ${item.estimatedCost} each
                                  {item.vendor && ` | ${item.vendor}`}
                                </div>
                                {item.status === 'denied' && item.denialReason && (
                                  <div className="mt-1 text-xs text-red-400">
                                    Denied: {item.denialReason}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium text-orange-400">
                                  ${(item.quantity * item.estimatedCost).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          )) : null}
                        </div>
                        
                        {materialList.totalEstimatedCost && (
                          <div className="mt-4 pt-4 border-t border-navy-500">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-semibold text-white">Total:</span>
                              <span className="text-xl font-bold text-orange-400">
                                ${Number(materialList.totalEstimatedCost).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Material List */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                {materialLists.length === 0 ? 'Create Material List' : 'Create New List'}
              </h3>
              {conversationId && (
                <MaterialListBuilder 
                  conversationId={conversationId} 
                  userRole={user?.role === 'contractor_user' ? 'contractor' : 'homeowner'}
                  onClose={() => setShowMaterialsDialog(false)}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}