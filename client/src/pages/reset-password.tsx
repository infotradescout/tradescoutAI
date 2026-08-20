import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { KeyRound } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  isProfileAccountResumePath,
  requestProfileAccountPasswordReset,
} from "@/components/profile/profileAccountClient";

function safeInternalPath(value: unknown): string {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return "";
  }
  try {
    const parsed = new URL(candidate, "https://reset-password.local");
    if (parsed.origin !== "https://reset-password.local") return "";
    if (decodeURIComponent(parsed.pathname).split("/").includes("..")) return "";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [codeStepVisible, setCodeStepVisible] = useState(false);

  const params = useMemo(() => {
    try {
      const index = location.indexOf("?");
      return new URLSearchParams(index === -1 ? "" : location.slice(index + 1));
    } catch {
      return new URLSearchParams();
    }
  }, [location]);
  const token = String(params.get("token") || "").trim();
  const safeNext = safeInternalPath(params.get("next"));
  const effectiveToken = token || verifiedToken;

  const requestResetMutation = useMutation({
    mutationFn: async () => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) throw new Error("Email is required");
      if (isProfileAccountResumePath(safeNext)) {
        return requestProfileAccountPasswordReset({
          email: normalizedEmail,
          next: safeNext,
        });
      }
      return apiRequest("POST", "/api/auth/request-password-reset", { email: normalizedEmail });
    },
    onSuccess: (data: any) => {
      setCodeStepVisible(true);
      toast({
        title: "Check your email",
        description: isProfileAccountResumePath(safeNext)
          ? "The reset link returns directly to the business account you were opening."
          : "We sent a reset link and verification code if the account exists for that email.",
      });
      if (data?.debugCode) {
        toast({ title: "Dev code", description: `Verification code: ${String(data.debugCode)}` });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Unable to send reset email",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async () => {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedCode = code.trim();
      if (!normalizedEmail) throw new Error("Email is required");
      if (!/^\d{6}$/.test(normalizedCode)) throw new Error("Verification code must be 6 digits");
      return apiRequest("POST", "/api/auth/verify-password-reset-code", {
        email: normalizedEmail,
        code: normalizedCode,
      });
    },
    onSuccess: (data: any) => {
      const nextToken = String(data?.token || "");
      if (!nextToken) {
        toast({
          title: "Verification failed",
          description: "No token was returned. Request a new code.",
          variant: "destructive",
        });
        return;
      }
      setVerifiedToken(nextToken);
      toast({ title: "Code verified", description: "Set your new password." });
    },
    onError: (error: any) => {
      toast({
        title: "Invalid code",
        description: formatUserFacingErrorMessage(error, "Please request a new code."),
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveToken) throw new Error("Missing reset token");
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      if (newPassword !== confirm) throw new Error("Passwords do not match");
      return apiRequest("POST", "/api/auth/reset-password", {
        token: effectiveToken,
        newPassword,
      });
    },
    onSuccess: () => {
      toast({ title: "Password set", description: "Sign in to continue." });
      if (isProfileAccountResumePath(safeNext)) {
        navigate(safeNext);
        return;
      }
      navigate(
        safeNext
          ? `/pre-scout-setup?mode=signin&next=${encodeURIComponent(safeNext)}`
          : "/pre-scout-setup?mode=signin"
      );
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: formatUserFacingErrorMessage(error, "Please request a new link."),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <SEOHelmet
        title="Reset Password | TradeScout"
        description="Reset your TradeScout password securely."
        canonical="https://www.thetradescout.com/reset-password"
        noIndex
      />
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <KeyRound className="h-5 w-5 text-ts-orange" />
            Reset Your Password
          </CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            {isProfileAccountResumePath(safeNext)
              ? "Set a password, then return directly to the business account you were opening."
              : "Use a reset link from email, or request a code and verify it first."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!effectiveToken ? (
            <>
              <div className="space-y-2">
                <label className="text-xs text-white/60">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="border-[color:var(--border-subtle)] bg-black/30"
                  placeholder="you@example.com"
                />
              </div>

              <Button
                className="w-full bg-ts-orange hover:bg-ts-orange-dark"
                onClick={() => requestResetMutation.mutate()}
                disabled={requestResetMutation.isPending}
              >
                {requestResetMutation.isPending ? "Sending..." : "Send Reset Email"}
              </Button>

              {codeStepVisible ? (
                <>
                  <div className="space-y-2 pt-2">
                    <label className="text-xs text-white/60">Verification code</label>
                    <Input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      className="border-[color:var(--border-subtle)] bg-black/30"
                      placeholder="6-digit code"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => verifyCodeMutation.mutate()}
                    disabled={verifyCodeMutation.isPending}
                  >
                    {verifyCodeMutation.isPending ? "Verifying..." : "Verify Code"}
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs text-white/60">New password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="border-[color:var(--border-subtle)] bg-black/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-white/60">Confirm password</label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="border-[color:var(--border-subtle)] bg-black/30"
                />
              </div>

              <Button
                className="w-full bg-ts-orange hover:bg-ts-orange-dark"
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? "Saving..." : "Save Password"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
