import { useLocation } from "wouter";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Send } from "lucide-react";
import type { MarketplaceListing } from "@shared/schema";

interface ConversationStarterProps {
  listing: MarketplaceListing;
  sellerId: string;
  sellerName?: string;
  className?: string;
}

export function ConversationStarter({
  listing,
  sellerId,
  sellerName,
  className,
}: ConversationStarterProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  const startConversationMutation = useMutation({
    mutationFn: (data: { listingId: string; sellerId: string; initialMessage: string }) =>
      apiRequest("POST", "/api/marketplace/conversations", data),
    onSuccess: (response) => {
      if (response?.pending) {
        setIsOpen(false);
        setMessage("");
        toast({
          title: "Request sent",
          description: "The seller must approve first contact before chat opens.",
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/conversations"] });
      setIsOpen(false);
      setMessage("");
      toast({
        title: "Request accepted",
        description: "Chat is open in your conversations.",
      });
      navigate("/conversations");
    },
    onError: (error: any) => {
      if (error.message.includes("already exists")) {
        toast({
          title: "Conversation exists",
          description: "You already have an active conversation for this listing.",
        });
        navigate("/conversations");
      } else if (error.message.includes("declined")) {
        toast({
          title: "Request declined",
          description: "This seller declined first contact for now.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to send request",
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
      initialMessage: message.trim(),
    });
  };

  if (!isAuthenticated || user?.id === sellerId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className={`bg-orange-600 hover:bg-orange-700 text-white ${className}`} size="lg">
          <MessageCircle className="h-4 w-4 mr-2" />
          Request Quote
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Request from {sellerName || "Seller"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">{listing.title}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ${listing.price.toLocaleString()}
            </p>
          </div>

          <form onSubmit={handleStartConversation} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Request details
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Hi, I'd like a quote for "${listing.title}". Is it still available?`}
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
                    Send Request
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="text-xs text-gray-500 space-y-1">
            <p>- Awareness does not unlock direct contact.</p>
            <p>- First contact always requires seller approval.</p>
            <p>- TradeScout opens chat only after approval.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuickContactButton({ listing, sellerId, className }: ConversationStarterProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  if (!isAuthenticated || user?.id === sellerId) {
    return null;
  }

  const handleQuickContact = () => {
    toast({
      title: "Request required",
      description: `Use Request Quote to send a request for ${listing.title}.`,
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
      <span className="hidden sm:inline">Request</span>
    </Button>
  );
}
