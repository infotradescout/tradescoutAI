import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

export default function CheckEmail() {
  const { isAuthenticated } = useAuth();
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
  const safeNext = next.startsWith("/") ? next : "";

  const [email, setEmail] = useState((params.get("email") || "").trim());
  const [isSending, setIsSending] = useState(false);

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
        title: "Verification email requested",
        description: resp?.message || "If an account exists, a new link has been sent.",
      });
      if (resp?.verificationToken) {
        console.warn("[EMAIL-VERIFY] Dev token:", resp.verificationToken);
      }
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

  const continueAfterVerify = () => {
    if (isAuthenticated) {
      navigate(safeNext || "/pre-scout-setup");
      return;
    }

    const emailParam = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : "";
    const nextParam = safeNext
      ? `${emailParam ? "&" : "?"}next=${encodeURIComponent(safeNext)}`
      : "";
    navigate(`/login${emailParam}${nextParam}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 text-tsTextMain">
      <Card className="w-full max-w-md bg-tsCard border border-tsBorder shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-tsTextMain">Check your email</CardTitle>
          <p className="text-sm text-tsTextMuted">
            We sent a verification link. Open it to confirm your email, then come back here.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-tsTextMuted">Email</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-tsBg border-tsBorder"
            />
          </div>
          <Button className="w-full" onClick={resend} disabled={isSending}>
            {isSending ? "Sending..." : "Resend verification email"}
          </Button>
          <Button variant="outline" className="w-full" onClick={continueAfterVerify}>
            I verified my email
          </Button>
          <div className="text-center text-xs text-tsTextMuted">
            Need a different email?{" "}
            <button
              type="button"
              className="text-tsAccent hover:underline"
              onClick={() => navigate("/create-account")}
            >
              Use a different account
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
