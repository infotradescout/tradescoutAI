import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  clearRememberedProfileAccountReturnPath,
  isProfileAccountResumePath,
  readRememberedProfileAccountReturnPath,
} from "@/components/profile/profileAccountClient";

type VerifyState = "loading" | "success" | "error";

function safeInternalPath(value: unknown): string {
  const candidate = String(value || "").trim();
  return candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")
    ? candidate
    : "";
}

function resolveVerificationNext(params: URLSearchParams): string {
  const requested = safeInternalPath(params.get("next"));
  const remembered = readRememberedProfileAccountReturnPath();
  if (remembered && (!requested || requested === "/pre-scout-setup")) return remembered;
  return requested;
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
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [resolvedNext, setResolvedNext] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    const safeNext = resolveVerificationNext(params);
    setResolvedNext(safeNext);

    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }

    let alive = true;
    apiRequest("POST", "/api/auth/verify-email", { token })
      .then((resp) => {
        if (!alive) return;
        setState("success");
        setMessage(resp?.message || "Email verified.");
        setVerifiedEmail(typeof resp?.email === "string" ? resp.email : "");
        if (resp?.autoLoggedIn) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
        }
        toast({
          title: "Email verified",
          description: "Verified. Routing now...",
        });

        try {
          if (safeNext) {
            const url = new URL(window.location.href);
            url.searchParams.set("next", safeNext);
            window.history.replaceState({}, "", url.toString());
          }
        } catch {
          // ignore
        }
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
    const t = window.setTimeout(() => {
      if (resolvedNext && (isAuthenticated || isProfileAccountResumePath(resolvedNext))) {
        clearRememberedProfileAccountReturnPath();
        setLocation(resolvedNext);
        return;
      }
      setLocation(signInDestination(verifiedEmail, resolvedNext));
    }, 900);
    return () => window.clearTimeout(t);
  }, [state, isAuthenticated, setLocation, verifiedEmail, resolvedNext]);

  const continueAfterVerification = () => {
    if (resolvedNext && (isAuthenticated || isProfileAccountResumePath(resolvedNext))) {
      clearRememberedProfileAccountReturnPath();
      setLocation(resolvedNext);
      return;
    }
    setLocation(signInDestination(verifiedEmail, resolvedNext));
  };

  return (
    <div className="flex items-center justify-center px-4 py-10 text-white">
      <Card className="w-full max-w-md bg-tsCard border border-white/10 shadow-2xl">
        <CardHeader className="text-center space-y-2">
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
