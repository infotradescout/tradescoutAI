import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isProfileAccountResumePath } from "@/components/profile/profileAccountClient";
import { isSafeNextPath } from "@/lib/postOnboardingRoute";

type VerifyState = "loading" | "success" | "error";

function readSafeNext(): string {
  const requested = String(new URLSearchParams(window.location.search).get("next") || "").trim();
  return isSafeNextPath(requested) ? requested : "";
}

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("Verifying...");
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [verifiedSession, setVerifiedSession] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    const safeNext = readSafeNext();

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
        setVerifiedSession(resp?.autoLoggedIn === true);
        // If the server auto-logged us in, refresh the auth cache so isAuthenticated
        // reflects the new session before the redirect effect fires.
        if (resp?.autoLoggedIn) {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
          queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
        }
        toast({
          title: "Email verified",
          description: "Verified. Routing now...",
        });

        // Persist `next` in the URL so the follow-up effect + Continue button share the same value.
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
    const safeNext = readSafeNext();
    const t = window.setTimeout(() => {
      if (isAuthenticated || verifiedSession || isProfileAccountResumePath(safeNext)) {
        setLocation(safeNext || "/pre-scout-setup");
        return;
      }
      const emailParam = verifiedEmail ? `?email=${encodeURIComponent(verifiedEmail)}` : "";
      const nextQ = safeNext ? `${emailParam ? "&" : "?"}next=${encodeURIComponent(safeNext)}` : "";
      setLocation(
        `/pre-scout-setup?mode=signin${emailParam ? `&${emailParam.slice(1)}` : ""}${nextQ ? `&${nextQ.slice(1)}` : ""}`
      );
    }, 900);
    return () => window.clearTimeout(t);
  }, [state, isAuthenticated, setLocation, verifiedEmail, verifiedSession]);

  return (
    <div className="flex items-center justify-center px-4 py-10 text-white">
      <Card className="w-full max-w-md bg-tsCard border border-white/10 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-white">Email verification</CardTitle>
          <p className="text-sm text-white/60">{message}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "success" && (
            <Button
              className="w-full"
              onClick={() => {
                const safeNext = readSafeNext();
                if (isAuthenticated || verifiedSession || isProfileAccountResumePath(safeNext)) {
                  setLocation(safeNext || "/pre-scout-setup");
                  return;
                }
                const emailParam = verifiedEmail
                  ? `?email=${encodeURIComponent(verifiedEmail)}`
                  : "";
                const nextQ = safeNext
                  ? `${emailParam ? "&" : "?"}next=${encodeURIComponent(safeNext)}`
                  : "";
                setLocation(
                  `/pre-scout-setup?mode=signin${emailParam ? `&${emailParam.slice(1)}` : ""}${nextQ ? `&${nextQ.slice(1)}` : ""}`
                );
              }}
            >
              Continue
            </Button>
          )}
          {state === "error" && (
            <>
              <Button
                className="w-full"
                onClick={() => setLocation("/pre-scout-setup?mode=signin")}
              >
                Sign in
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/pre-scout-setup?mode=create")}
              >
                Create account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
