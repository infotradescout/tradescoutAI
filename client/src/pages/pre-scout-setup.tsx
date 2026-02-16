import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StateCountySelector } from "@/components/state-county-selector";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProfileDraft, PresenceType } from "@/types/profileDraft";

type AuthMode = "create" | "signin";

function sanitizePostSetupNext(next: string) {
  if (!next.startsWith("/")) return "/scout?onboarding=true";
  if (
    next.startsWith("/login") ||
    next.startsWith("/create-account") ||
    next.startsWith("/pre-scout-setup")
  ) {
    return "/scout?onboarding=true";
  }
  return next;
}

export default function PreScoutSetup() {
  const { user, isAuthenticated, refetch } = useAuth();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const searchParams = useMemo(() => {
    try {
      const query = String(location || "").split("?")[1] || "";
      return new URLSearchParams(query);
    } catch {
      return new URLSearchParams();
    }
  }, [location]);
  const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const nextParam = (searchParams.get("next") || "").trim();
  const safeNext = nextParam.startsWith("/") ? nextParam : "";
  const postSetupNext = sanitizePostSetupNext(safeNext);
  const safeNextQuery = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
  const prefilledEmail = (searchParams.get("email") || "").trim();
  const requestedAuthMode: AuthMode =
    String(searchParams.get("mode") || "").toLowerCase() === "signin" ? "signin" : "create";

  const provisional = useMemo(() => (user as any)?.preferences?.provisional || {}, [user]);
  const existingDraft: ProfileDraft | undefined = provisional?.profileDraft;

  const [presenceType, setPresenceType] = useState<PresenceType>(
    existingDraft?.presenceType || "personal"
  );
  const [stateCode, setStateCode] = useState(existingDraft?.stateCode || "");
  const [countyFips, setCountyFips] = useState(existingDraft?.countyFips || "");
  const [countyName, setCountyName] = useState<string | undefined>(existingDraft?.countyName);
  const [businessName, setBusinessName] = useState(existingDraft?.businessName || "");
  const [submitting, setSubmitting] = useState(false);

  const [authMode, setAuthMode] = useState<AuthMode>(requestedAuthMode);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [signInEmail, setSignInEmail] = useState(prefilledEmail);
  const [signInPassword, setSignInPassword] = useState("");

  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState(prefilledEmail);
  const [createPhone, setCreatePhone] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirmPassword, setCreateConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    if (!existingDraft) return;
    setPresenceType(existingDraft.presenceType || "personal");
    setStateCode(existingDraft.stateCode || "");
    setCountyFips(existingDraft.countyFips || "");
    setCountyName(existingDraft.countyName);
    setBusinessName(existingDraft.businessName || "");
  }, [existingDraft]);

  useEffect(() => {
    setAuthMode(requestedAuthMode);
  }, [requestedAuthMode]);

  const canContinue = useMemo(() => {
    if (!presenceType || !stateCode || !countyFips) return false;
    if (presenceType === "represent_business" && !businessName.trim()) return false;
    return true;
  }, [presenceType, stateCode, countyFips, businessName]);

  const beginOAuth = (provider: "google" | "facebook") => {
    const next = encodeURIComponent(`/pre-scout-setup${safeNextQuery}`);
    window.location.assign(`${apiBaseUrl}/api/auth/${provider}?next=${next}`);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;

    const email = signInEmail.trim();
    const password = signInPassword;
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Enter email and password.",
        variant: "destructive",
      });
      return;
    }

    setAuthSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/login", { email, password });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      try {
        await refetch?.();
      } catch {
        // fail-soft
      }
      toast({ title: "Signed in", description: "Continue with local setup." });
      navigate(`/pre-scout-setup${safeNextQuery}`);
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;

    const email = createEmail.trim();
    const phone = createPhone.trim();
    const firstName = createFirstName.trim();
    const lastName = createLastName.trim();

    if (!firstName || !lastName || !email || !phone || !createPassword) {
      toast({
        title: "Missing fields",
        description: "Complete all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (createPassword !== createConfirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords must match.",
        variant: "destructive",
      });
      return;
    }

    if (createPassword.length < 8) {
      toast({
        title: "Weak password",
        description: "Use at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: "Terms required",
        description: "Accept the Terms of Service to continue.",
        variant: "destructive",
      });
      return;
    }

    setAuthSubmitting(true);
    try {
      const resp: any = await apiRequest("POST", "/api/auth/register", {
        firstName,
        lastName,
        email,
        phone,
        password: createPassword,
        userTypes: [],
        userIntent: "",
        acceptTerms: true,
        allowPhoneCalls: false,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      try {
        await refetch?.();
      } catch {
        // fail-soft
      }

      if (resp?.emailVerificationRequired === true) {
        const emailParam = `email=${encodeURIComponent(email)}`;
        const nextValue = encodeURIComponent(`/pre-scout-setup${safeNextQuery}`);
        navigate(`/check-email?${emailParam}&next=${nextValue}`);
        return;
      }

      toast({ title: "Account created", description: "Continue with local setup." });
      navigate(`/pre-scout-setup${safeNextQuery}`);
    } catch (error: any) {
      const message = error?.message || "Unable to create account.";
      if (String(message).toLowerCase().includes("already exists")) {
        toast({
          title: "Account exists",
          description: "Sign in to continue.",
        });
        setAuthMode("signin");
        setSignInEmail(email);
      } else {
        toast({
          title: "Create account failed",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canContinue) return;

    setSubmitting(true);
    try {
      const draft: ProfileDraft = {
        ...(existingDraft || {}),
        presenceType,
        stateCode,
        countyFips,
        countyName: countyName || undefined,
        businessName: presenceType === "represent_business" ? businessName.trim() : undefined,
        serviceAreas: [
          {
            countyFips,
            countyName: countyName || undefined,
            stateCode,
            primary: true,
          },
        ],
        capturedAt: new Date().toISOString(),
      };

      const provisionalNext = {
        ...provisional,
        profileDraft: draft,
      };

      await apiRequest("/api/user/preferences", {
        method: "PATCH",
        body: { provisional: provisionalNext },
      });

      toast({
        title: "Setup saved",
        description: "Opening your workspace.",
      });

      navigate(postSetupNext);
    } catch (error: any) {
      toast({
        title: "Couldn't save",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-3 py-4 md:px-4 md:py-8 text-tsTextMain">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.05fr_minmax(0,1fr)] gap-4 md:gap-6">
          <div className="space-y-3 md:space-y-4">
            <div className="inline-flex items-center rounded-full border border-tsBorder/60 bg-black/40 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-tsAccentSoft">
              Step 1 of 2
            </div>
            <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-white leading-tight">
              Sign in. Get local.
            </h1>
          </div>

          <Card className="bg-tsCard border border-tsBorder">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl text-tsTextMain">Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMode("create")}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    authMode === "create"
                      ? "border-tsAccent bg-tsAccent/10 text-tsTextMain"
                      : "border-tsBorder text-tsTextMuted"
                  }`}
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("signin")}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    authMode === "signin"
                      ? "border-tsAccent bg-tsAccent/10 text-tsTextMain"
                      : "border-tsBorder text-tsTextMuted"
                  }`}
                >
                  Sign in
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => beginOAuth("google")}
                >
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => beginOAuth("facebook")}
                >
                  Facebook
                </Button>
              </div>

              {authMode === "signin" ? (
                <form onSubmit={handleSignIn} className="space-y-2">
                  <div>
                    <Label className="text-sm">Email</Label>
                    <Input
                      type="email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Password</Label>
                    <Input
                      type="password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="Your password"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href="/reset-password"
                      className="text-xs text-tsTextMuted hover:text-tsTextMain underline-offset-2 hover:underline"
                    >
                      Forgot password
                    </a>
                    <Button type="submit" disabled={authSubmitting}>
                      {authSubmitting ? "Signing in..." : "Sign in"}
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCreateAccount} className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-sm">First name</Label>
                      <Input
                        value={createFirstName}
                        onChange={(e) => setCreateFirstName(e.target.value)}
                        placeholder="First"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Last name</Label>
                      <Input
                        value={createLastName}
                        onChange={(e) => setCreateLastName(e.target.value)}
                        placeholder="Last"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Email</Label>
                    <Input
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Phone</Label>
                    <Input
                      value={createPhone}
                      onChange={(e) => setCreatePhone(e.target.value)}
                      placeholder="(555) 555-5555"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-sm">Password</Label>
                      <Input
                        type="password"
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Confirm</Label>
                      <Input
                        type="password"
                        value={createConfirmPassword}
                        onChange={(e) => setCreateConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        required
                      />
                    </div>
                  </div>
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-tsTextMuted">Agree to Terms + Privacy.</span>
                  </label>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={authSubmitting}>
                      {authSubmitting ? "Creating..." : "Create account"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex justify-center px-3 py-4 md:px-4 md:py-8 text-tsTextMain">
      <div className="w-full max-w-3xl space-y-3">
        <Button
          variant="ghost"
          onClick={() => navigate("/scout")}
          className="px-0 text-tsTextMuted hover:text-white hover:bg-transparent"
        >
          Back to Scout
        </Button>

        <Card className="bg-tsCard border border-tsBorder">
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="text-xl text-tsTextMain">Local setup</CardTitle>
              </div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-tsTextMuted">
                Step 2/2
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm">Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPresenceType("personal")}
                    className={`w-full text-center rounded-lg border px-3 py-2.5 transition ${
                      presenceType === "personal"
                        ? "border-tsAccent bg-tsAccent/10"
                        : "border-tsBorder hover:border-tsAccent/60"
                    }`}
                  >
                    <div className="text-sm font-semibold text-tsTextMain">Personal</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresenceType("represent_business")}
                    className={`w-full text-center rounded-lg border px-3 py-2.5 transition ${
                      presenceType === "represent_business"
                        ? "border-tsAccent bg-tsAccent/10"
                        : "border-tsBorder hover:border-tsAccent/60"
                    }`}
                  >
                    <div className="text-sm font-semibold text-tsTextMain">Business</div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Primary county</Label>
                <StateCountySelector
                  selectedState={stateCode}
                  selectedCounty={countyFips}
                  onStateChange={setStateCode}
                  onCountyChange={setCountyFips}
                  className="gap-2"
                  onCountySelected={(county) => {
                    setCountyName(county?.name);
                  }}
                />
              </div>

              {presenceType === "represent_business" && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Business name</Label>
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Business name"
                    required
                  />
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-tsTextMuted">
                  {canContinue ? "Ready." : "Select state and county."}
                </p>
                <Button type="submit" disabled={!canContinue || submitting}>
                  {submitting ? "Saving..." : "Continue"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
