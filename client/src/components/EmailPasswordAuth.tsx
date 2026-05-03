import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isSuperAdminLike } from "@/lib/roleChecks";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { resolveDirectConnectLandingRoute } from "@/lib/postOnboardingRoute";

export function EmailPasswordAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return new URLSearchParams();
    }
  }, []);
  const emailPrefill = (params.get("email") || "").trim();
  const nextParam = (params.get("next") || "").trim();
  const safeNext = nextParam.startsWith("/") ? nextParam : "";
  const [emailValue, setEmailValue] = useState(emailPrefill);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    setAuthErrorCode(null);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const result = await apiRequest("POST", "/api/auth/login", { email, password });

      toast({
        title: "Signed in successfully",
        description: `Welcome to TradeScout${
          result?.user?.firstName ? `, ${result.user.firstName}` : ""
        }!`,
      });

      // Ensure the global auth query flips from "guest" to "user" before we route away.
      // This prevents ProtectedRoute from immediately redirecting back to /create-account.
      try {
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      } catch {
        // Fail-soft: routing will still work for most users, and the next mount will refetch auth.
      }

      const anyUser: any = result?.user || result;
      const role: string | undefined = anyUser?.role;
      const isSuperAdmin = isSuperAdminLike(role) || anyUser?.isSuperAdmin === true;
      if (safeNext) {
        window.location.href = safeNext;
        return;
      }
      window.location.href = isSuperAdmin
        ? "/admin"
        : resolveDirectConnectLandingRoute({ entry: "auth" });
    } catch (error) {
      console.error("Authentication error:", error);
      const anyErr: any = error as any;
      const code = typeof anyErr?.code === "string" ? anyErr.code : null;
      const rawMessage = error instanceof Error ? error.message : "Please try again.";
      const message =
        code === "AUTH_NO_ACCOUNT"
          ? "No account found for that email."
          : code === "AUTH_INCORRECT_PASSWORD"
            ? "Incorrect password."
            : code === "AUTH_SOCIAL_ONLY"
              ? "This account uses Google/Facebook sign-in."
              : rawMessage;
      setAuthError(message);
      setAuthErrorCode(code);
      toast({
        title: "Authentication failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async () => {
    const email = (emailValue || "").trim();
    if (!email) {
      toast({ title: "Email required", description: "Enter your email first." });
      return;
    }
    setIsResending(true);
    try {
      const resp = await apiRequest("POST", "/api/auth/request-email-verification", {
        email,
        next: safeNext || "/pre-scout-setup",
      });
      toast({
        title: "Verification email requested",
        description: resp?.message || "If an account exists, a new link has been sent.",
      });
      if (resp?.verificationToken) {
        console.warn("[EMAIL-VERIFY] Dev token:", resp.verificationToken);
      }
    } catch (error: any) {
      toast({
        title: "Resend failed",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Your password"
          onChange={() => {
            if (authError) setAuthError(null);
            if (authErrorCode) setAuthErrorCode(null);
          }}
        />
        {authError && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">
              {authError}
            </p>
            {authErrorCode === "AUTH_NO_ACCOUNT" && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={`/pre-scout-setup?mode=create&email=${encodeURIComponent(
                    (emailValue || "").trim()
                  )}`}
                  className="inline-flex items-center justify-center rounded-full border border-ts-orange/60 px-3 py-1 font-medium text-ts-orange hover:bg-ts-orange hover:text-black transition"
                >
                  Create an account
                </Link>
                <Link
                  href="/maps"
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-subtle)] px-3 py-1 font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-elevated)] transition"
                >
                  Find and claim a business
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign in"}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={resendVerification}
        disabled={isResending}
      >
        {isResending ? "Sending..." : "Resend verification email"}
      </Button>

      <div className="mt-3 space-y-1 text-center">
        <p className="text-xs text-white/60">New here?</p>
        <Link
          href="/pre-scout-setup?mode=create"
          className="inline-flex items-center justify-center rounded-full border border-ts-orange/60 px-3 py-1 text-xs font-medium text-ts-orange hover:bg-ts-orange hover:text-black transition"
        >
          Create a free TradeScout account
        </Link>
      </div>
    </form>
  );
}
