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
        title: "Email sent",
        description: resp?.message || "If the account exists, a new link was sent.",
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
    navigate(
      `/pre-scout-setup?mode=signin${emailParam ? `&${emailParam.slice(1)}` : ""}${nextParam ? `&${nextParam.slice(1)}` : ""}`
    );
  };

  return (
    <div className="flex items-center justify-center px-4 py-10 text-white">
      <Card className="w-full max-w-md bg-tsCard border border-white/10 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-white">Check your email</CardTitle>
          <p className="text-sm text-white/60">Open the link, then return here.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-white/60">Email</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-tsBg border-white/10"
            />
          </div>
          <Button className="w-full" onClick={resend} disabled={isSending}>
            {isSending ? "Sending..." : "Resend email"}
          </Button>
          <Button variant="outline" className="w-full" onClick={continueAfterVerify}>
            I verified my email
          </Button>
          <div className="text-center text-xs text-white/60">
            Different email?{" "}
            <button
              type="button"
              className="text-ts-orange hover:underline"
              onClick={() => navigate("/pre-scout-setup?mode=create")}
            >
              Use another account
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
