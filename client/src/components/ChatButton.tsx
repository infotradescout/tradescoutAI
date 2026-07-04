import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { buildAuthEntryRoute } from "@/lib/postOnboardingRoute";

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
  ),
}: ChatButtonProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams({
    intent: "hire",
    contractorId,
  });
  if (leadId) params.set("leadId", leadId);
  const directConnectHref = `/direct-connect?${params.toString()}`;

  const handleStartChat = () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to start Direct Connect.",
        variant: "destructive",
      });
      setLocation(buildAuthEntryRoute({ mode: "signin", next: directConnectHref }));
      return;
    }

    setLocation(directConnectHref);
  };

  return (
    <Button onClick={handleStartChat} disabled={false} className={`btn-primary ${className}`}>
      {children}
    </Button>
  );
}
