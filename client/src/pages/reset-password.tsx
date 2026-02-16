import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const token = useMemo(() => {
    try {
      const idx = location.indexOf("?");
      if (idx === -1) return "";
      const params = new URLSearchParams(location.slice(idx + 1));
      return String(params.get("token") || "").trim();
    } catch {
      return "";
    }
  }, [location]);

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Missing token");
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      if (newPassword !== confirm) throw new Error("Passwords do not match");
      return apiRequest("POST", "/api/auth/reset-password", { token, newPassword });
    },
    onSuccess: () => {
      toast({ title: "Password set", description: "You can now sign in." });
      navigate("/pre-scout-setup?mode=signin");
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error?.message || "Please request a new link.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <KeyRound className="h-5 w-5 text-orange-400" />
            Set Your Password
          </CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            This link is single-use and expires quickly. If it fails, request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!token ? (
            <div className="text-sm text-slate-300">Missing token. Check your reset link.</div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs text-slate-400">New password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-slate-950/40 border-[color:var(--border-subtle)]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">Confirm password</label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="bg-slate-950/40 border-[color:var(--border-subtle)]"
            />
          </div>

          <Button
            className="bg-orange-500 hover:bg-orange-600 w-full"
            onClick={() => resetMutation.mutate()}
            disabled={!token || resetMutation.isPending}
          >
            {resetMutation.isPending ? "Saving..." : "Save Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
