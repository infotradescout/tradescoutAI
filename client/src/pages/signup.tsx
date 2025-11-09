import { useEffect } from "react";
import { AuthFlow } from "@/components/auth/AuthFlow";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useLocation } from "wouter";

export default function Signup() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Get account type from URL query parameter
  const searchParams = new URLSearchParams(window.location.search);
  const accountType = searchParams.get('type') as 'homeowner' | 'professional' | null;

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation('/');
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen gradient-bg">
      <AuthFlow 
        onComplete={() => setLocation('/')} 
        initialType={accountType || undefined}
      />
    </div>
  );
}