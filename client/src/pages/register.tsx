import { useEffect } from "react";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { useAuth } from "@/hooks/useAuth";

export default function Register() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/profile-setup";
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <EmailPasswordAuth />;
}