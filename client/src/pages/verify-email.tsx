import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type VerifyState = "loading" | "success" | "error";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";

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
        setMessage(resp?.message || "Email verified successfully.");
        setVerifiedEmail(typeof resp?.email === "string" ? resp.email : "");
        toast({
          title: "Email verified",
          description: "Verified. Routing you to the next step...",
        });
      })
      .catch((error: any) => {
        if (!alive) return;
        setState("error");
        setMessage(error?.message || "Verification failed. Please request a new link.");
      });

    return () => {
      alive = false;
    };
  }, [toast]);

  useEffect(() => {
    if (state !== "success") return;
    const t = window.setTimeout(() => {
      if (isAuthenticated) {
        setLocation("/pre-scout-setup");
        return;
      }
      const emailParam = verifiedEmail ? `?email=${encodeURIComponent(verifiedEmail)}` : "";
      setLocation(`/login${emailParam}`);
    }, 900);
    return () => window.clearTimeout(t);
  }, [state, isAuthenticated, setLocation, verifiedEmail]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 text-tsTextMain">
      <Card className="w-full max-w-md bg-tsCard border border-tsBorder shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-tsTextMain">Verify Email</CardTitle>
          <p className="text-sm text-tsTextMuted">{message}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "success" && (
            <Button
              className="w-full"
              onClick={() => {
                if (isAuthenticated) {
                  setLocation("/pre-scout-setup");
                  return;
                }
                const emailParam = verifiedEmail
                  ? `?email=${encodeURIComponent(verifiedEmail)}`
                  : "";
                setLocation(`/login${emailParam}`);
              }}
            >
              Continue
            </Button>
          )}
          {state === "error" && (
            <>
              <Button className="w-full" onClick={() => setLocation("/login")}>
                Go to login
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/create-account")}
              >
                Create a new account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
