import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Send, User } from "lucide-react";
import type { MarketplaceListing } from "@shared/schema";

interface ConversationStarterProps {
  listing: MarketplaceListing;
  sellerId: string;
  sellerName?: string;
  className?: string;
}

export function ConversationStarter({ listing, sellerId, sellerName, className }: ConversationStarterProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  // Start conversation mutation
  const startConversationMutation = useMutation({
    mutationFn: (data: { listingId: string; sellerId: string; initialMessage: string }) =>
      apiRequest("POST", "/api/marketplace/conversations", data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/conversations"] });
      setIsOpen(false);
      setMessage("");
      toast({
        title: "Conversation started!",
        description: "Your message has been sent to the seller",
      });
      
      // Redirect to conversations page
      window.location.href = "/conversations";
    },
    onError: (error: any) => {
      if (error.message.includes("already exists")) {
        toast({
          title: "Conversation exists",
          description: "You already have a conversation about this item",
          variant: "destructive",
        });
        // Redirect to existing conversation
        window.location.href = "/conversations";
      } else {
        toast({
          title: "Error",
          description: "Failed to start conversation",
          variant: "destructive",
        });
      }
    },
  });

  const handleStartConversation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    startConversationMutation.mutate({
      listingId: listing.id,
      sellerId,
      initialMessage: message.trim()
    });
  };

  // Don't show button if user is the seller
  if (!isAuthenticated || user?.id === sellerId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className={`bg-orange-600 hover:bg-orange-700 text-white ${className}`}
          size="lg"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Contact Seller
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Contact {sellerName || 'Seller'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Listing Preview */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">
              {listing.title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ${listing.price.toLocaleString()}
            </p>
          </div>
          
          {/* Message Form */}
          <form onSubmit={handleStartConversation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your message to the seller
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Hi! I'm interested in your ${listing.title}. Is it still available?`}
                rows={4}
                className="w-full"
                disabled={startConversationMutation.isPending}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
                disabled={startConversationMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!message.trim() || startConversationMutation.isPending}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {startConversationMutation.isPending ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </form>
          
          {/* Trust indicators */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Your message will be private between you and the seller</p>
            <p>• All conversations are monitored for community safety</p>
            <p>• You can rate your experience after completing a transaction</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Quick contact button for use in listing cards
export function QuickContactButton({ listing, sellerId, className }: ConversationStarterProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  if (!isAuthenticated || user?.id === sellerId) {
    return null;
  }

  const handleQuickContact = () => {
    // You can either open the dialog or navigate directly to a contact form
    // For now, let's show a simple toast to encourage using the main contact button
    toast({
      title: "Contact the seller",
      description: "Use the 'Contact Seller' button to start a conversation",
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleQuickContact}
      className={`flex items-center gap-2 ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Message</span>
    </Button>
  );
}