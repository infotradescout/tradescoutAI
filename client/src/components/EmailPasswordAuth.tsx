import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export function EmailPasswordAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message || "Authentication failed");
      }

      const result = await response.json();

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
      const isSuperAdmin =
        role === "super_admin" || role === "head_admin" || anyUser?.isSuperAdmin === true;
      window.location.href = isSuperAdmin ? "/admin" : "/dashboard";
    } catch (error) {
      console.error("Authentication error:", error);
      toast({
        title: "Authentication failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Signing in..." : "Sign in"}
      </Button>

      <div className="mt-3 space-y-1 text-center">
        <p className="text-xs text-tsTextMuted">New here?</p>
        <Link
          href="/create-account"
          className="inline-flex items-center justify-center rounded-full border border-tsAccent/60 px-3 py-1 text-xs font-medium text-tsAccent hover:bg-tsAccent hover:text-black transition"
        >
          Create a free TradeScout account
        </Link>
      </div>
    </form>
  );
}
