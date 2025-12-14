import { useEffect } from "react";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home } from "lucide-react";

export default function Login() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/profile-setup";
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] text-tsTextMain">
        <div className="animate-spin w-8 h-8 border-4 border-tsAccent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1e] via-[#0f172a] to-[#0a0f1e] text-tsTextMain flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md bg-tsCard border border-tsBorder shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-tsAccent to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Home className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-tsTextMain">Welcome back to TradeScout</CardTitle>
          <p className="text-sm text-tsTextMuted">Sign in to access your dashboard, marketplace, and community tools.</p>
        </CardHeader>
        <CardContent>
          <div className="bg-[#0b1224] border border-tsBorder rounded-xl p-4">
            <EmailPasswordAuth />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}