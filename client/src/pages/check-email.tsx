import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { buildAuthEntryRoute, isSafeNextPath } from "@/lib/postOnboardingRoute";
import { isRecommendationActionPath } from "@shared/recommendationContinuation";

export default function CheckEmail() {
  const { isAuthenticated, refetch } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const params = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return new URLSearchParams();
    }
  }, []);

  const next = (params.get("next") || "").trim();
  const safeNext = isSafeNextPath(next) ? next : "";
  const isRecommendation = isRecommendationActionPath(safeNext);

  const [email, setEmail] = useState((params.get("email") || "").trim());
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const resend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast({ title: "Email required", description: "Enter your email to resend the link." });
      return;
    }
    setIsSending(true);
    try {
      const resp = await apiRequest("POST", "/api/auth/request-email-verification", {
        email: trimmed,
        next: safeNext || "/pre-scout-setup",
      });
      toast({
        title: "Confirmation requested",
        description: resp?.message || "If the account exists, a new link was sent.",
      });
    } catch (e: any) {
      toast({
        title: "Resend failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const continueAfterVerify = async () => {
    if (isAuthenticated) {
      if (isChecking) return;
      setIsChecking(true);
      setStatusMessage("");
      try {
        const result = await refetch();
        if (result.error) throw result.error;
        if (result.data?.emailVerified === true) {
          navigate(safeNext || "/pre-scout-setup");
        } else {
          setStatusMessage(
            "Your email is still awaiting confirmation. Open the link in your inbox or request another."
          );
        }
      } catch (error: any) {
        setStatusMessage(
          error?.message || "We couldn't check your confirmation. Please try again."
        );
      } finally {
        setIsChecking(false);
      }
      return;
    }
    navigate(buildAuthEntryRoute({ mode: "signin", email, next: safeNext }));
  };

  return (
    <div className="flex items-center justify-center px-4 py-10 text-white">
      <Card className="w-full max-w-md bg-tsCard border border-white/10 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-white">Check your email</CardTitle>
          <p className="text-sm text-white/60">
            {isRecommendation
              ? "Open the confirmation link to return to your recommendation. It stays private until approved."
              : "Open the link, then return here."}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="verification-email" className="text-xs text-white/60">
              Email
            </label>
            <Input
              id="verification-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-tsBg border-white/10"
            />
          </div>
          <Button className="w-full" onClick={resend} disabled={isSending}>
            {isSending ? "Sending..." : "Resend email"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            disabled={isChecking}
            onClick={continueAfterVerify}
          >
            {isChecking ? "Checking confirmation…" : "I verified my email"}
          </Button>
          {statusMessage && (
            <p role="status" className="text-sm text-white/60">
              {statusMessage}
            </p>
          )}
          {isRecommendation && (
            <Button variant="ghost" className="w-full" onClick={() => navigate(safeNext)}>
              Back to recommendation
            </Button>
          )}
          <div className="text-center text-xs text-white/60">
            Different email?{" "}
            <button
              type="button"
              className="text-ts-orange hover:underline"
              onClick={() => navigate(buildAuthEntryRoute({ mode: "create", next: safeNext }))}
            >
              Use another account
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
