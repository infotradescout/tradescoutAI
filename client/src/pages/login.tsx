import { useEffect } from "react";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home } from "lucide-react";

export default function Login() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const params = (() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return new URLSearchParams();
    }
  })();
  const nextParam = (params.get("next") || "").trim();
  const safeNext = nextParam.startsWith("/") ? nextParam : "";

  useEffect(() => {
    if (isAuthenticated) {
      if (safeNext) {
        window.location.href = safeNext;
        return;
      }
      const role = String((user as any)?.role || "");
      const isSuperAdmin =
        role === "super_admin" || role === "head_admin" || (user as any)?.isSuperAdmin === true;
      window.location.href = isSuperAdmin ? "/admin" : "/scout";
    }
  }, [isAuthenticated, user, safeNext]);

  const beginOAuth = (provider: "google" | "facebook") => {
    const next = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
    window.location.assign(`${apiBaseUrl}/api/auth/${provider}${next}`);
  };

  return (
    <div className="min-h-[calc(var(--app-height)-var(--top-nav-h)-var(--bottom-nav-h))] text-tsTextMain flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md bg-tsCard border border-tsBorder shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-tsAccent to-orange-700 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Home className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-tsTextMain">
            Welcome back to TradeScout
          </CardTitle>
          <p className="text-sm text-tsTextMuted">
            Sign in to access your dashboard, Exchange, and community tools.
          </p>
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
            {isLoading && <div className="mt-2 text-xs text-slate-400">Checking session...</div>}
          </div>
          <div className="bg-tsBg border border-tsBorder rounded-xl p-4 mt-3">
            <EmailPasswordAuth />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
