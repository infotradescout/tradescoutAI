import { useEffect } from "react";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home } from "lucide-react";

export default function Login() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/";
    }
  }, [isAuthenticated]);

  const beginOAuth = (provider: "google" | "facebook") => {
    window.location.assign(`/api/auth/${provider}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-tsBg via-slate-900 to-tsBg text-tsTextMain flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md bg-tsCard border border-tsBorder shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-tsAccent to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Home className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-tsTextMain">Welcome back to TradeScout</CardTitle>
          <p className="text-sm text-tsTextMuted">Sign in to access your dashboard, Exchange, and community tools.</p>
        </CardHeader>
        <CardContent>
          <div className="bg-tsBg border border-tsBorder rounded-xl p-4">
            <div className="text-sm text-slate-300">Continue with</div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:bg-slate-800"
                onClick={() => beginOAuth("google")}
                disabled={isLoading}
              >
                Google
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:bg-slate-800"
                onClick={() => beginOAuth("facebook")}
                disabled={isLoading}
              >
                Facebook
              </button>
            </div>
            {isLoading && <div className="mt-2 text-xs text-slate-400">Checking session…</div>}
          </div>
          <div className="bg-tsBg border border-tsBorder rounded-xl p-4">
            <EmailPasswordAuth />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}