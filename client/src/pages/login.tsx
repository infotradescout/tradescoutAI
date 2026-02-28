import { useEffect } from "react";
import { motion } from "framer-motion";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { buildApiUrl } from "@/lib/apiBaseUrl";

export default function Login() {
  const { user, isAuthenticated, isLoading } = useAuth();
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
    window.location.assign(buildApiUrl(`/api/auth/${provider}${next}`));
  };

  return (
    <div className="min-h-[calc(var(--app-height)-var(--top-nav-h)-var(--bottom-nav-h))] flex items-center justify-center px-4 py-8 font-body">
      <SEOHelmet
        title="TradeScout Login"
        description="Sign in to continue using TradeScout."
        canonical="https://www.thetradescout.com/login"
        noIndex
      />
      <motion.div
        initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="bg-tsCard border border-white/10 rounded-xl p-5 md:p-6 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
          {/* Header */}
          <div className="text-center space-y-3 mb-5">
            <div className="mx-auto w-12 h-12 bg-ts-orange/20 rounded-lg flex items-center justify-center">
              <Home className="h-6 w-6 text-ts-orange" />
            </div>
            <h1 className="font-display text-2xl font-extrabold text-white">
              Welcome back to TradeScout
            </h1>
            <p className="text-sm text-white/60">
              Sign in to access your dashboard, Exchange, and community tools.
            </p>
          </div>

          {/* OAuth */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/60">Continue with</div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Button
                type="button"
                onClick={() => beginOAuth("google")}
                disabled={isLoading}
                className="w-full bg-white/10 border border-white/10 text-white hover:bg-white/15 font-semibold h-10 rounded-lg transition-all"
              >
                Google
              </Button>
              <Button
                type="button"
                onClick={() => beginOAuth("facebook")}
                disabled={isLoading}
                className="w-full bg-white/10 border border-white/10 text-white hover:bg-white/15 font-semibold h-10 rounded-lg transition-all"
              >
                Facebook
              </Button>
            </div>
            {isLoading && (
              <div className="mt-2 text-xs text-white/40">Checking session...</div>
            )}
          </div>

          {/* Email/Password */}
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <EmailPasswordAuth />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
