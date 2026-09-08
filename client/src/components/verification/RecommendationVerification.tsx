import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { buildAuthEntryRoute } from "@/lib/postOnboardingRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function RecommendationVerification({ returnPath }: { returnPath: string }) {
  const { user, isAuthenticated, isLoading, refetch } = useAuth();
  const [, navigate] = useLocation();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const emailConfirmed = isAuthenticated && user?.emailVerified === true;
  const verificationPath = `/verification?next=${encodeURIComponent(returnPath)}`;

  useEffect(() => {
    // Email links can be opened in another tab. Refresh the existing account
    // status when the person returns without sending any additional email.
    if (!isAuthenticated) return;
    const refresh = () => void refetch();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [isAuthenticated, refetch]);

  async function requestConfirmation() {
    if (sending || !user?.email) return;
    setSending(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("POST", "/api/auth/request-email-verification", {
        email: user.email,
        next: returnPath,
      });
      setRequested(true);
      setMessage(
        "Confirmation requested. Check your inbox for a link, then return to your recommendation."
      );
    } catch (failure: any) {
      setError(failure?.message || "We couldn't request the confirmation email. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function checkConfirmation() {
    if (checking) return;
    setChecking(true);
    setError("");
    setMessage("");
    try {
      const result = await refetch();
      if (result.error) throw result.error;
      if (result.data?.emailVerified === true) {
        navigate(returnPath);
      } else {
        setMessage(
          "Your email is still awaiting confirmation. Open the link in your inbox or request another."
        );
      }
    } catch (failure: any) {
      setError(failure?.message || "We couldn't check your email status. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[36rem] px-4 py-8 md:py-12">
      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader className="space-y-3">
          {emailConfirmed ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden="true" />
          ) : (
            <Mail className="h-8 w-8 text-ts-orange" aria-hidden="true" />
          )}
          <CardTitle className="text-2xl">
            {emailConfirmed ? "Email confirmed" : "Confirm your email to share your recommendation"}
          </CardTitle>
          <CardDescription className="text-sm leading-6">
            {emailConfirmed
              ? "You can return to your recommendation. It will become public after approval."
              : "Recommendations stay private until your email is confirmed and the recommendation is approved."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && !user ? (
            <p role="status" className="text-sm text-muted-foreground">
              Checking your account…
            </p>
          ) : !isAuthenticated ? (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in to continue with your recommendation.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <Link href={buildAuthEntryRoute({ mode: "signin", next: verificationPath })}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={buildAuthEntryRoute({ mode: "create", next: verificationPath })}>
                    Create account
                  </Link>
                </Button>
              </div>
            </>
          ) : emailConfirmed ? (
            <Button className="w-full" onClick={() => navigate(returnPath)}>
              Return to recommendation
            </Button>
          ) : (
            <>
              <div className="rounded-lg border border-[color:var(--border-subtle)] p-4">
                <p className="text-sm font-medium">Confirm email ownership</p>
                <p className="mt-1 break-all text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Button
                className="w-full"
                disabled={sending || !user?.email}
                onClick={requestConfirmation}
              >
                {sending
                  ? "Requesting email…"
                  : requested
                    ? "Send another link"
                    : "Send confirmation email"}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                disabled={checking}
                onClick={checkConfirmation}
              >
                {checking ? "Checking confirmation…" : "I confirmed my email"}
              </Button>
            </>
          )}
          {message && (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {!emailConfirmed && (
            <Button className="w-full" variant="ghost" onClick={() => navigate(returnPath)}>
              Back to recommendation
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
