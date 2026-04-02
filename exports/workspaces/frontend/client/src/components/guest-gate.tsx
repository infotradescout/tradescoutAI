import { useState, useEffect } from "react";
import { AuthModal } from "./auth-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Star, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface GuestGateProps {
  children: React.ReactNode;
  action: string; // e.g., "contact this contractor", "get quotes", "save contractors"
  title?: string;
  description?: string;
}

export function GuestGate({ 
  children, 
  action, 
  title = "Create Account to Continue",
  description = "To ensure authentic interactions and protect our contractors, you need an account to proceed."
}: GuestGateProps) {
  const { isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);

  useEffect(() => {
    const guestMode = localStorage.getItem('guestMode');
    setIsGuestMode(guestMode === 'true');
  }, []);

  // If user is authenticated, show content
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // If user is in guest mode, show the gate
  if (isGuestMode) {
    return (
      <div className="space-y-4">
        {/* Guest limitation notice */}
        <Card className="bg-ts-orange/10 border-ts-orange/30">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <Lock className="w-6 h-6 text-ts-orange" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-white/70 mb-4">{description}</p>
                
                <div className="space-y-2 mb-4 text-sm text-white/60">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4" />
                    <span>Verified contractor interactions</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4" />
                    <span>Personalized recommendations</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4" />
                    <span>Secure quote requests</span>
                  </div>
                </div>

                <Button 
                  onClick={() => setShowAuthModal(true)}
                  className="bg-ts-orange hover:bg-ts-orange-dark text-white shadow-lg shadow-ts-orange/25"
                >
                  Create Free Account to {action}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Show limited version of content */}
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>

        {/* Authentication Modal */}
        <AuthModal 
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title={`Create Account to ${action}`}
          description="Join thousands of residents, pros, and community members on TradeScout"
          trigger="guest_gate"
          showGuestOption={false}
        />
      </div>
    );
  }

  // If user is not in guest mode, show content normally (they'll be redirected to auth)
  return <>{children}</>;
}