import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle } from "lucide-react";
import { useLocation } from "wouter";

interface ChatButtonProps {
  contractorId: string;
  leadId?: string;
  className?: string;
  children?: React.ReactNode;
}

export function ChatButton({ 
  contractorId, 
  leadId, 
  className = "",
  children = (
    <>
      <MessageCircle className="h-4 w-4 mr-2" />
      Start Chat
    </>
  )
}: ChatButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/conversations", {
        contractorId,
        leadId,
      });
    },
    onSuccess: (conversation: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setLocation(`/chat/${conversation.id}`);
      toast({
        title: "Chat Started",
        description: "Your conversation with the contractor has been created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to start chat. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartChat = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to start a chat with contractors.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    createConversationMutation.mutate();
  };

  return (
    <Button
      onClick={handleStartChat}
      disabled={createConversationMutation.isPending}
      className={`btn-primary ${className}`}
    >
      {children}
    </Button>
  );
}