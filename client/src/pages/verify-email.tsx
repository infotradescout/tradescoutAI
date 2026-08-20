import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isProfileAccountResumePath } from "@/components/profile/profileAccountClient";

type VerifyState = "loading" | "success" | "error";

function safeInternalPath(value: unknown): string {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return "";
  }
  try {
    const parsed = new URL(candidate, "https://verify-email.local");
    if (parsed.origin !== "https://verify-email.local") return "";
    if (decodeURIComponent(parsed.pathname).split("/").includes("..")) return "";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}

function signInDestination(email: string, safeNext: string): string {
  const params = new URLSearchParams({ mode: "signin" });
  if (email) params.set("email", email);
  if (safeNext) params.set("next", safeNext);
  return `/pre-scout-setup?${params.toString()}`;
}

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("Verifying...");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [resolvedNext, setResolvedNext] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    const safeNext = safeInternalPath(params.get("next"));
    setResolvedNext(safeNext);

    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }

    let alive = true;
    apiRequest("POST", "/api/auth/verify-email", { token })
      .then((response) => {
        if (!alive) return;
        setState("success");
        setMessage(response?.message || "Email verified.");
        setVerifiedEmail(typeof response?.email === "string" ? response.email : "");
        if (response?.autoLoggedIn) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
        }
        toast({
          title: "Email verified",
          description: safeNext ? "Returning to your account." : "Verified. Routing now...",
        });
      })
      .catch((error: any) => {
        if (!alive) return;
        setState("error");
        setMessage(error?.message || "Verification failed. Request a new link.");
      });

    return () => {
      alive = false;
    };
  }, [toast]);

  useEffect(() => {
    if (state !== "success") return;
    const timer = window.setTimeout(() => {
      if (resolvedNext && (isAuthenticated || isProfileAccountResumePath(resolvedNext))) {
        setLocation(resolvedNext);
        return;
      }
      setLocation(signInDestination(verifiedEmail, resolvedNext));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [state, isAuthenticated, setLocation, verifiedEmail, resolvedNext]);

  const continueAfterVerification = () => {
    if (resolvedNext && (isAuthenticated || isProfileAccountResumePath(resolvedNext))) {
      setLocation(resolvedNext);
      return;
    }
    setLocation(signInDestination(verifiedEmail, resolvedNext));
  };

  return (
    <div className="flex items-center justify-center px-4 py-10 text-white">
      <Card className="w-full max-w-md border border-white/10 bg-tsCard shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold text-white">Email verification</CardTitle>
          <p className="text-sm text-white/60">{message}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "success" ? (
            <Button className="w-full" onClick={continueAfterVerification}>
              Continue
            </Button>
          ) : null}
          {state === "error" ? (
            <>
              {isProfileAccountResumePath(resolvedNext) ? (
                <Button className="w-full" onClick={() => setLocation(resolvedNext)}>
                  Return to the business account
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => setLocation("/pre-scout-setup?mode=signin")}
                >
                  Sign in
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/pre-scout-setup?mode=create")}
              >
                Create account
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
