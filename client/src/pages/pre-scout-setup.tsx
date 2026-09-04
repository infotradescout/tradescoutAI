import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StateCountySelector } from "@/components/state-county-selector";
import {
  GooglePlacesLocationInput,
  type PlaceResult,
} from "@/components/GooglePlacesLocationInput";
import {
  GooglePlacesBusinessInput,
  type BusinessPlaceResult,
} from "@/components/GooglePlacesBusinessInput";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl, getApiBaseUrl } from "@/lib/apiBaseUrl";
import { inferCountyForCityState } from "@/lib/countyInference";
import type { ProfileDraft, PresenceType } from "@/types/profileDraft";
import { SEOHelmet } from "@/components/SEOHelmet";
import { bootstrapDemandAttribution, trackDemandEvent } from "@/lib/demandEngine";
import { trackShellEvent } from "@/lib/analytics";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { resolvePreScoutAuthenticatedRoute, sanitizePreScoutNext } from "@/lib/preScoutAuthHandoff";
import { resolveCanonicalCountyForState } from "@/lib/countyNameNormalization";

type AuthMode = "create" | "signin";
type CountyInferenceStatus = "idle" | "loading" | "inferred" | "ambiguous" | "error";

function oauthFailureMessage(code: string): string | null {
  if (code === "AUTH_ACCOUNT_LINK_REQUIRED") {
    return "That email already belongs to an account. Sign in with its existing method; no accounts were linked or changed.";
  }
  if (code === "AUTH_IDENTITY_COLLISION") {
    return "We found conflicting account records. Sign in with your existing method or use account recovery; no accounts were linked or changed.";
  }
  if (code === "AUTH_OAUTH_FAILED") {
    return "Social sign-in could not be completed. Try again or use your existing sign-in method.";
  }
  return null;
}

export default function PreScoutSetup() {
  const { user, isAuthenticated, refetch } = useAuth();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const parseAuthMode = (value: string | null): AuthMode | null => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (normalized === "signin") return "signin";
    if (normalized === "create") return "create";
    return null;
  };

  let searchParams: URLSearchParams;
  let locationSearchParams: URLSearchParams;
  let windowSearchParams: URLSearchParams;
  try {
    const fromLocation = String(location || "").split("?")[1] || "";
    const fromWindow =
      typeof window !== "undefined" ? String(window.location.search || "").replace(/^\?/, "") : "";
    locationSearchParams = new URLSearchParams(fromLocation);
    windowSearchParams = new URLSearchParams(fromWindow);

    // Merge query sources so either can fill missing keys; prefer router state
    // for conflicting keys during in-app mode switches.
    const merged = new URLSearchParams(fromWindow);
    locationSearchParams.forEach((value, key) => {
      merged.set(key, value);
    });
    searchParams = merged;
  } catch {
    locationSearchParams = new URLSearchParams();
    windowSearchParams = new URLSearchParams();
    searchParams = new URLSearchParams();
  }
  const apiBaseUrl = getApiBaseUrl();
  const nextParam = (searchParams.get("next") || "").trim();
  const safeNext = sanitizePreScoutNext(nextParam);
  const postSetupNext = safeNext;
  const isDirectConnectDestination = postSetupNext.startsWith("/direct-connect");
  const isAdminDestination = postSetupNext.startsWith("/admin");
  const anyUser: any = user || {};
  const onboardingCompleted = anyUser.onboardingCompleted === true;
  const prefilledEmail = (searchParams.get("email") || "").trim();
  const claimSlug = (searchParams.get("claim") || "").trim();
  const claimBusinessIdParam = (searchParams.get("claimBusinessId") || "").trim();
  const requestedAuthMode: AuthMode =
    parseAuthMode(windowSearchParams.get("mode")) ||
    parseAuthMode(locationSearchParams.get("mode")) ||
    "create";
  const oauthErrorCode = (searchParams.get("oauthError") || "").trim();
  const oauthError = oauthFailureMessage(oauthErrorCode);

  const provisional = useMemo(() => (user as any)?.preferences?.provisional || {}, [user]);
  const existingDraft: ProfileDraft | undefined = provisional?.profileDraft;

  const [presenceType, setPresenceType] = useState<PresenceType>(
    existingDraft?.presenceType || "personal"
  );
  const [stateCode, setStateCode] = useState(existingDraft?.stateCode || "");
  const [countyFips, setCountyFips] = useState(existingDraft?.countyFips || "");
  const [countyName, setCountyName] = useState<string | undefined>(existingDraft?.countyName);
  const [city, setCity] = useState(existingDraft?.city || "");
  const [countyInferenceStatus, setCountyInferenceStatus] = useState<CountyInferenceStatus>("idle");
  const [countyInferenceNote, setCountyInferenceNote] = useState("");
  // Track whether location was resolved via Google Places (vs. manual typing)
  const [locationSource, setLocationSource] = useState<"places" | "manual" | "none">("none");
  const [businessName, setBusinessName] = useState(existingDraft?.businessName || "");
  const [businessType, setBusinessType] = useState<ProfileDraft["businessType"]>(
    existingDraft?.businessType || "contractor_trades"
  );
  const [submitting, setSubmitting] = useState(false);

  const [authMode, setAuthMode] = useState<AuthMode>(requestedAuthMode);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [signInEmail, setSignInEmail] = useState(prefilledEmail);
  const [signInPassword, setSignInPassword] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInErrorCode, setSignInErrorCode] = useState<string | null>(null);

  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState(prefilledEmail);
  const [createPhone, setCreatePhone] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirmPassword, setCreateConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createErrorCode, setCreateErrorCode] = useState<string | null>(null);

  const authStepTitle = isDirectConnectDestination
    ? authMode === "create"
      ? "Create your account to send this Direct Connect request."
      : "Sign in to send this Direct Connect request."
    : authMode === "create"
      ? "Create your account to continue."
      : "Sign in to continue.";
  const authStepDescription = isDirectConnectDestination
    ? authMode === "create"
      ? "Your request draft is safe. Create a free account and go straight back to finish sending it."
      : "Your request draft is safe. Sign in and go straight back to finish sending it."
    : authMode === "create"
      ? "Start here so Scout can save your progress, then tell onboarding the result you want."
      : "Sign in to pick up where you left off.";
  const authenticatedNextPath = useMemo(() => {
    return resolvePreScoutAuthenticatedRoute({
      explicitNext: postSetupNext,
      onboardingCompleted,
    });
  }, [onboardingCompleted, postSetupNext]);
  const setAuthModeAndSyncUrl = (nextMode: AuthMode) => {
    setCreateError(null);
    setCreateErrorCode(null);
    setSignInError(null);
    setSignInErrorCode(null);
    try {
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams(searchParams);
      params.set("mode", nextMode);
      const nextPath = `/pre-scout-setup?${params.toString()}`;
      if (typeof window !== "undefined") {
        const current = `${window.location.pathname}${window.location.search}`;
        if (current !== nextPath) {
          window.history.replaceState(window.history.state, "", nextPath);
          navigate(nextPath);
        }
      } else {
        navigate(nextPath);
      }
    } catch {
      // Never block auth mode switch on URL sync issues.
    }
    setAuthMode(nextMode);
  };
  const authInputClass =
    "mt-1 h-10 border-white/10 bg-black/30 text-white placeholder:text-white/60 focus-visible:ring-ts-orange/70 [-webkit-text-fill-color:theme(colors.slate.100)] [&:-webkit-autofill]:shadow-[0_0_0px_1000px_rgba(5,12,22,0.96)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:theme(colors.slate.100)]";

  useEffect(() => {
    if (!existingDraft) return;
    setPresenceType(existingDraft.presenceType || "personal");
    setStateCode(existingDraft.stateCode || "");
    setCountyFips(existingDraft.countyFips || "");
    setCountyName(existingDraft.countyName);
    setCity(existingDraft.city || "");
    setBusinessName(existingDraft.businessName || "");
    setBusinessType(existingDraft.businessType || "contractor_trades");
  }, [existingDraft]);

  // handlePlaceSelected: called when user picks a result from Google Places Autocomplete
  const handlePlaceSelected = useCallback(async (result: PlaceResult) => {
    const newCity = result.city || "";
    const newState = result.stateCode || "";
    const newCountyName = result.countyName || "";

    setCity(newCity);
    if (newState) setStateCode(newState);
    setLocationSource("places");

    // Reset county while we resolve FIPS
    const canonicalFromPlace = resolveCanonicalCountyForState(newCountyName, newState);
    if (canonicalFromPlace?.countyFips) {
      setCountyFips(canonicalFromPlace.countyFips);
      setCountyName(canonicalFromPlace.countyName);
      setCountyInferenceStatus("inferred");
      setCountyInferenceNote(
        `Confirmed: ${canonicalFromPlace.countyName}, ${canonicalFromPlace.stateCode}`
      );
      return;
    }

    setCountyFips("");
    setCountyName(newCountyName || undefined);
    setCountyInferenceStatus("loading");
    setCountyInferenceNote("Resolving county…");

    if (!newState || (!newCity && !newCountyName)) {
      setCountyInferenceStatus("idle");
      setCountyInferenceNote("");
      return;
    }

    try {
      const inferCity = newCountyName || newCity;
      const inferred = await inferCountyForCityState({
        city: inferCity,
        stateCode: newState,
      });

      if (inferred?.inferred?.countyFips) {
        setCountyFips(inferred.inferred.countyFips);
        setCountyName(inferred.inferred.countyName || newCountyName || undefined);
        setCountyInferenceStatus("inferred");
        setCountyInferenceNote(
          `Confirmed: ${inferred.inferred.countyName}, ${inferred.inferred.stateCode}`
        );
      } else if (inferred?.ambiguous) {
        setCountyInferenceStatus("ambiguous");
        setCountyInferenceNote("Multiple counties match — select yours below.");
      } else {
        const normalizedFound = resolveCanonicalCountyForState(newCountyName, newState);
        if (normalizedFound?.countyName) {
          setCountyInferenceStatus("ambiguous");
          setCountyInferenceNote(
            `Found "${normalizedFound.countyName}" — confirm your county below.`
          );
        } else {
          setCountyInferenceStatus("ambiguous");
          setCountyInferenceNote(
            newCountyName
              ? `Found "${newCountyName}" — confirm your county below.`
              : "Select your county below to confirm."
          );
        }
      }
    } catch {
      setCountyInferenceStatus("error");
      setCountyInferenceNote("Could not resolve county. Select it manually below.");
    }
  }, []);

  /**
   * Called when the user selects a business from the Google Places Business
   * autocomplete. Pre-fills business name, city, state, and triggers county
   * resolution — the same pipeline as the location input.
   */
  const handleBusinessSelected = useCallback(async (result: BusinessPlaceResult) => {
    if (result.businessName) setBusinessName(result.businessName);
    const newCity = result.city || "";
    const newState = result.stateCode || "";
    const newCountyName = result.countyName || "";

    if (newCity) setCity(newCity);
    if (newState) setStateCode(newState);
    if (newCity || newState) setLocationSource("places");

    // Trigger county resolution if we have enough data
    if (newState && (newCity || newCountyName)) {
      const canonicalFromBusinessPlace = resolveCanonicalCountyForState(newCountyName, newState);
      if (canonicalFromBusinessPlace?.countyFips) {
        setCountyFips(canonicalFromBusinessPlace.countyFips);
        setCountyName(canonicalFromBusinessPlace.countyName);
        setCountyInferenceStatus("inferred");
        setCountyInferenceNote(
          `Confirmed: ${canonicalFromBusinessPlace.countyName}, ${canonicalFromBusinessPlace.stateCode}`
        );
        return;
      }

      setCountyFips("");
      setCountyName(newCountyName || undefined);
      setCountyInferenceStatus("loading");
      setCountyInferenceNote("Resolving county…");
      try {
        const inferred = await inferCountyForCityState({
          city: newCountyName || newCity,
          stateCode: newState,
        });
        if (inferred?.inferred?.countyFips) {
          setCountyFips(inferred.inferred.countyFips);
          setCountyName(inferred.inferred.countyName || newCountyName || undefined);
          setCountyInferenceStatus("inferred");
          setCountyInferenceNote(
            `Confirmed: ${inferred.inferred.countyName}, ${inferred.inferred.stateCode}`
          );
        } else {
          const normalizedFound = resolveCanonicalCountyForState(newCountyName, newState);
          setCountyInferenceStatus("ambiguous");
          setCountyInferenceNote(
            normalizedFound?.countyName
              ? `Found "${normalizedFound.countyName}" — confirm your county below.`
              : newCountyName
                ? `Found "${newCountyName}" — confirm your county below.`
                : "Select your county below to confirm."
          );
        }
      } catch {
        setCountyInferenceStatus("error");
        setCountyInferenceNote("Could not resolve county. Select it manually below.");
      }
    }
  }, []);

  useEffect(() => {
    // Skip inference when location came from Google Places — already resolved
    if (locationSource === "places") return;

    const normalizedCity = city.trim();
    if (!/^[A-Z]{2}$/.test(stateCode) || normalizedCity.length < 2) {
      setCountyInferenceStatus("idle");
      setCountyInferenceNote("");
      return;
    }
    if (countyFips) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCountyInferenceStatus("loading");
      setCountyInferenceNote("");
      try {
        const inferred = await inferCountyForCityState({
          city: normalizedCity,
          stateCode,
          signal: controller.signal,
        });
        if (cancelled) return;
        if (inferred?.inferred?.countyFips) {
          setCountyFips(inferred.inferred.countyFips);
          setCountyName(inferred.inferred.countyName || undefined);
          setCountyInferenceStatus("inferred");
          setCountyInferenceNote(
            `Auto-selected ${inferred.inferred.countyName}, ${inferred.inferred.stateCode}.`
          );
          return;
        }
        if (inferred?.ambiguous) {
          setCountyInferenceStatus("ambiguous");
          setCountyInferenceNote("Multiple counties match — select yours below.");
          return;
        }
        setCountyInferenceStatus("error");
        setCountyInferenceNote("Could not infer county. Select it manually below.");
      } catch (error: any) {
        if (cancelled || error?.name === "AbortError") return;
        setCountyInferenceStatus("error");
        setCountyInferenceNote("Could not infer county right now. Select it manually below.");
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [city, countyFips, stateCode, locationSource]);

  useEffect(() => {
    setAuthMode(requestedAuthMode);
    setSignInError(null);
    setSignInErrorCode(null);
    setCreateError(null);
  }, [requestedAuthMode]);

  useEffect(() => {
    if (!oauthError) return;
    setAuthMode("signin");
    setSignInError(oauthError);
    setSignInErrorCode(oauthErrorCode);
  }, [oauthError, oauthErrorCode]);

  useEffect(() => {
    if (isAuthenticated) return;
    bootstrapDemandAttribution();
    void trackDemandEvent("auth_view", { mode: authMode });
    // Funnel event: user arrived at the very first onboarding step
    void trackShellEvent({
      type: "onboarding_funnel_started",
      presenceType: null,
      mode: authMode ?? "unknown",
      ts: new Date().toISOString(),
    });
  }, [authMode, isAuthenticated]);

  // Admin should not be blocked by local setup. If auth returns to setup with an admin destination,
  // forward immediately.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!isAdminDestination) return;
    navigate(postSetupNext);
  }, [isAuthenticated, isAdminDestination, postSetupNext, navigate]);

  // Pre-scout setup is an auth handoff only. Main onboarding owns setup data.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isAdminDestination) return;
    navigate(authenticatedNextPath);
  }, [authenticatedNextPath, isAuthenticated, isAdminDestination, navigate]);

  const canContinue = useMemo(() => {
    if (!presenceType || !stateCode || !countyFips) return false;
    if (presenceType === "represent_business" && !businessName.trim()) return false;
    if (presenceType === "represent_business" && !businessType) return false;
    return true;
  }, [presenceType, stateCode, countyFips, businessName, businessType]);

  const buildAuthReturnPath = useCallback(
    (mode: AuthMode) => {
      const params = new URLSearchParams();
      params.set("mode", mode);
      if (postSetupNext) {
        params.set("next", postSetupNext);
      }
      if (claimBusinessIdParam) {
        params.set("claimBusinessId", claimBusinessIdParam);
      } else if (claimSlug) {
        params.set("claim", claimSlug);
      }
      return `/pre-scout-setup?${params.toString()}`;
    },
    [postSetupNext, claimBusinessIdParam, claimSlug]
  );

  const beginOAuth = (provider: "google" | "facebook") => {
    const next = encodeURIComponent(buildAuthReturnPath(authMode));
    window.location.assign(`${apiBaseUrl}/api/auth/${provider}?next=${next}`);
  };
  const oauthHref = (provider: "google" | "facebook") => {
    const next = encodeURIComponent(buildAuthReturnPath(authMode));
    return `${apiBaseUrl}/api/auth/${provider}?next=${next}`;
  };

  const ensureSessionEstablished = async (): Promise<boolean> => {
    const authUrl = buildApiUrl("/api/auth/user");
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const response = await fetch(authUrl, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (response.ok) {
          const payload: any = await response.json().catch(() => null);
          if (payload?.authenticated === true && payload?.user) {
            return true;
          }
        }
      } catch {
        // Ignore transient network errors and retry.
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
    return false;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode !== "signin") {
      setAuthModeAndSyncUrl("signin");
      return;
    }
    if (authSubmitting) return;
    setSignInError(null);
    setSignInErrorCode(null);

    const email = signInEmail.trim();
    const password = signInPassword;
    if (!email || !password) {
      const message = "Enter email and password.";
      setSignInError(message);
      setSignInErrorCode("AUTH_MISSING_FIELDS");
      toast({
        title: "Missing fields",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setAuthSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/login", { email, password });
      const sessionReady = await ensureSessionEstablished();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      try {
        await refetch?.();
      } catch {
        // fail-soft
      }
      if (!sessionReady) {
        toast({
          title: "Finalizing sign in",
          description: "Session propagation is taking longer than expected. Retrying now.",
        });
      }
      void trackDemandEvent("signin_success", { mode: "signin" });
      toast({ title: "Signed in", description: "Opening onboarding." });
      navigate(isAdminDestination ? postSetupNext : authenticatedNextPath);
    } catch (error: any) {
      const code = typeof error?.code === "string" ? error.code : null;
      const rawMessage = String(error?.message || "Please try again.");
      const lowered = rawMessage.toLowerCase();
      const message =
        code === "AUTH_INCORRECT_PASSWORD" || lowered.includes("incorrect password")
          ? "Incorrect password."
          : code === "AUTH_NO_ACCOUNT" ||
              lowered.includes("account not found") ||
              lowered.includes("no account")
            ? "No account found for that email."
            : code === "AUTH_SOCIAL_ONLY" || lowered.includes("social login")
              ? "This account uses Google/Facebook sign-in."
              : rawMessage;
      setSignInError(message);
      setSignInErrorCode(code);
      toast({
        title: "Sign in failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode !== "create") {
      setAuthModeAndSyncUrl("create");
      return;
    }
    if (authSubmitting) return;
    setCreateError(null);
    setCreateErrorCode(null);

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
        description: "Accept the Terms of Service to create your account.",
        variant: "destructive",
      });
      return;
    }

    setAuthSubmitting(true);
    try {
      let claimBusinessId = claimBusinessIdParam;
      if (!claimBusinessId && claimSlug) {
        try {
          const res = await fetch(
            `/api/business-claim/resolve?slug=${encodeURIComponent(claimSlug)}`
          );
          const data: any = res.ok ? await res.json() : null;
          claimBusinessId = String(data?.business?.id || "").trim();
        } catch {
          // fail-soft: claim is optional
        }
      }

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
        ...(claimBusinessId ? { claimBusinessId } : {}),
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      try {
        await refetch?.();
      } catch {
        // fail-soft
      }

      if (resp?.emailVerificationRequired === true) {
        void trackDemandEvent("create_success", { mode: "create", verificationRequired: true });
        const emailParam = `email=${encodeURIComponent(email)}`;
        const nextValue = encodeURIComponent(buildAuthReturnPath("create"));
        navigate(`/check-email?${emailParam}&next=${nextValue}`);
        return;
      }

      await ensureSessionEstablished();
      void trackDemandEvent("create_success", { mode: "create", verificationRequired: false });
      toast({ title: "Account created", description: "Opening onboarding." });
      navigate(isAdminDestination ? postSetupNext : authenticatedNextPath);
    } catch (error: any) {
      const code = typeof error?.code === "string" ? error.code : null;
      const message = error?.message || "Unable to create account.";
      const accountExists =
        code === "AUTH_ACCOUNT_EXISTS" ||
        code === "AUTH_ACCOUNT_EXISTS_SOCIAL_ONLY" ||
        String(message).toLowerCase().includes("already exists");
      if (accountExists) {
        const explicitMessage =
          code === "AUTH_ACCOUNT_EXISTS_SOCIAL_ONLY"
            ? "An account with this email already exists. Sign in with Google/Facebook or reset your password."
            : "An account with this email already exists. Sign in to continue.";
        // Keep create-account mode active so users see the exact failure context
        // and can choose to switch modes explicitly.
        setCreateError(explicitMessage);
        setCreateErrorCode(code ?? "AUTH_ACCOUNT_EXISTS");
        setSignInEmail(email);
        toast({
          title: "Account exists",
          description: explicitMessage,
        });
      } else {
        setCreateError(message);
        setCreateErrorCode(code);
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
        city: city.trim() || undefined,
        businessName: presenceType === "represent_business" ? businessName.trim() : undefined,
        businessType: presenceType === "represent_business" ? businessType : undefined,
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

      // Fail-soft: persist the user's locality to local storage so the session layer can
      // immediately route even if auth cache propagation lags.
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            "userLocation",
            JSON.stringify({
              stateCode,
              countyFips,
              countyName: countyName || undefined,
              city: city.trim() || undefined,
              label: countyName ? `${countyName}, ${stateCode}` : `${stateCode} ${countyFips}`,
              committedAt: new Date().toISOString(),
            })
          );
        }
      } catch {
        // ignore
      }

      // Ensure the authenticated user cache reflects the saved draft before
      // navigating into Scout, otherwise protected routes can bounce users
      // back into setup with stale profileVersion/preferences.
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      try {
        await refetch?.();
      } catch {
        // fail-soft
      }

      toast({
        title: "Area saved",
        description: "Opening the next step.",
      });

      void trackDemandEvent("setup_complete", {
        mode: isAuthenticated ? "authenticated" : "guest",
        presenceType,
        stateCode,
        countyFips,
      });
      // Funnel event: pre-scout-setup form submitted successfully
      void trackShellEvent({
        type: "onboarding_profile_submitted",
        presenceType: (presenceType as "personal" | "represent_business") ?? null,
        hasBusinessName: Boolean(businessName?.trim()),
        hasCountyFips: Boolean(countyFips?.trim()),
        locationSource: locationSource ?? null,
        ts: new Date().toISOString(),
      });

      if (isAdminDestination) {
        navigate(postSetupNext);
        return;
      }

      // Local setup and outcome onboarding are separate. Only the explicit
      // completion flag controls whether this user still needs onboarding.
      if (!onboardingCompleted) {
        navigate(
          postSetupNext ? `/onboarding?next=${encodeURIComponent(postSetupNext)}` : "/onboarding"
        );
        return;
      }

      navigate(postSetupNext || "/scout");
    } catch (error: any) {
      toast({
        title: "Couldn't save",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <SEOHelmet
          title="Account Setup | TradeScout"
          description="Finish your TradeScout account setup."
          canonical="https://www.thetradescout.com/pre-scout-setup"
          noIndex
        />
        <div className="flex min-h-full items-center justify-center px-3 py-4 md:px-4 md:py-8 text-white">
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.05fr_minmax(0,1fr)] gap-4 md:gap-6">
            <div className="space-y-3 md:space-y-4">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-ts-orange">
                Account access
              </div>
              <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-white leading-tight">
                {authStepTitle}
              </h1>
              <p className="max-w-md text-sm text-white/60">{authStepDescription}</p>
              {isDirectConnectDestination && (
                <div className="max-w-md rounded-2xl border border-ts-orange/25 bg-ts-orange/10 px-4 py-3 text-sm text-white/80">
                  Direct contact stays protected. You will return to your request before anything is
                  sent.
                </div>
              )}
            </div>

            <Card className="rounded-2xl border border-white/10 bg-tsCard/95 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle
                  className="text-lg font-semibold text-white"
                  data-testid="auth-indicator"
                >
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
                  <button
                    type="button"
                    onClick={() => setAuthModeAndSyncUrl("create")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      authMode === "create"
                        ? "bg-ts-orange/20 text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthModeAndSyncUrl("signin")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      authMode === "signin"
                        ? "bg-ts-orange/20 text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Sign in
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    asChild
                    variant="outline"
                    className="h-9 w-full border-white/10 bg-black/20 text-white hover:bg-black/35"
                  >
                    <a
                      href={oauthHref("google")}
                      data-testid={authMode === "signin" ? "login-google" : "auth-google"}
                      onClick={(e) => {
                        e.preventDefault();
                        beginOAuth("google");
                      }}
                    >
                      Google
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-9 w-full border-white/10 bg-black/20 text-white hover:bg-black/35"
                  >
                    <a
                      href={oauthHref("facebook")}
                      data-testid={authMode === "signin" ? "login-facebook" : "auth-facebook"}
                      onClick={(e) => {
                        e.preventDefault();
                        beginOAuth("facebook");
                      }}
                    >
                      Facebook
                    </a>
                  </Button>
                </div>

                <div className="relative py-0.5">
                  <div className="border-t border-white/10" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-tsCard px-2 text-[11px] uppercase tracking-[0.12em] text-white/60">
                    Email
                  </span>
                </div>

                {authMode === "signin" ? (
                  <form onSubmit={handleSignIn} className="space-y-2.5">
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                        Email
                      </Label>
                      <Input
                        id="signin-email"
                        data-testid="login-email"
                        name="email"
                        type="email"
                        value={signInEmail}
                        onChange={(e) => {
                          setSignInEmail(e.target.value);
                          if (signInError) setSignInError(null);
                          if (signInErrorCode) setSignInErrorCode(null);
                        }}
                        autoComplete="email"
                        placeholder="you@example.com"
                        className={authInputClass}
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                        Password
                      </Label>
                      <Input
                        id="signin-password"
                        data-testid="login-password"
                        name="password"
                        type="password"
                        value={signInPassword}
                        onChange={(e) => {
                          setSignInPassword(e.target.value);
                          if (signInError) setSignInError(null);
                          if (signInErrorCode) setSignInErrorCode(null);
                        }}
                        autoComplete="current-password"
                        placeholder="Your password"
                        className={authInputClass}
                        required
                      />
                      {signInError && (
                        <div className="mt-1 space-y-2">
                          <p role="alert" className="text-xs text-destructive">
                            {signInError}
                          </p>
                          {signInErrorCode === "AUTH_NO_ACCOUNT" && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-7 rounded-full border-ts-orange/60 px-3 text-ts-orange hover:bg-ts-orange hover:text-black"
                                onClick={() => {
                                  setCreateEmail(signInEmail.trim());
                                  setAuthModeAndSyncUrl("create");
                                }}
                              >
                                Create account
                              </Button>
                              <a
                                href="/maps"
                                className="underline-offset-2 hover:underline text-white/60 hover:text-white"
                              >
                                Find and claim a business
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <a
                        href="/reset-password"
                        data-testid="forgot-password"
                        className="text-xs text-white/60 hover:text-white underline-offset-2 hover:underline"
                      >
                        Forgot password
                      </a>
                      <Button
                        type="submit"
                        data-testid="login-submit"
                        disabled={authSubmitting}
                        className="h-9 bg-ts-orange text-white hover:bg-ts-orange/90"
                      >
                        {authSubmitting
                          ? "Signing in..."
                          : isDirectConnectDestination
                            ? "Sign in to continue"
                            : "Sign in"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleCreateAccount} className="space-y-2.5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          First name
                        </Label>
                        <Input
                          id="create-first-name"
                          data-testid="signup-name"
                          name="firstName"
                          value={createFirstName}
                          onChange={(e) => {
                            setCreateFirstName(e.target.value);
                            if (createError) {
                              setCreateError(null);
                              setCreateErrorCode(null);
                            }
                          }}
                          autoComplete="given-name"
                          placeholder="First"
                          className={authInputClass}
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Last name
                        </Label>
                        <Input
                          id="create-last-name"
                          name="lastName"
                          value={createLastName}
                          onChange={(e) => {
                            setCreateLastName(e.target.value);
                            if (createError) {
                              setCreateError(null);
                              setCreateErrorCode(null);
                            }
                          }}
                          autoComplete="family-name"
                          placeholder="Last"
                          className={authInputClass}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                        Email
                      </Label>
                      <Input
                        id="create-email"
                        data-testid="signup-email"
                        name="email"
                        type="email"
                        value={createEmail}
                        onChange={(e) => {
                          setCreateEmail(e.target.value);
                          if (createError) {
                            setCreateError(null);
                            setCreateErrorCode(null);
                          }
                        }}
                        autoComplete="email"
                        placeholder="you@example.com"
                        className={authInputClass}
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                        Phone
                      </Label>
                      <Input
                        id="create-phone"
                        name="phone"
                        value={createPhone}
                        onChange={(e) => {
                          setCreatePhone(e.target.value);
                          if (createError) {
                            setCreateError(null);
                            setCreateErrorCode(null);
                          }
                        }}
                        autoComplete="tel"
                        placeholder="(555) 555-5555"
                        className={authInputClass}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Password
                        </Label>
                        <Input
                          id="create-password"
                          data-testid="signup-password"
                          name="password"
                          type="password"
                          value={createPassword}
                          onChange={(e) => {
                            setCreatePassword(e.target.value);
                            if (createError) {
                              setCreateError(null);
                              setCreateErrorCode(null);
                            }
                          }}
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                          className={authInputClass}
                          required
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Confirm
                        </Label>
                        <Input
                          id="create-confirm-password"
                          name="confirmPassword"
                          type="password"
                          value={createConfirmPassword}
                          onChange={(e) => {
                            setCreateConfirmPassword(e.target.value);
                            if (createError) {
                              setCreateError(null);
                              setCreateErrorCode(null);
                            }
                          }}
                          autoComplete="new-password"
                          placeholder="Repeat password"
                          className={authInputClass}
                          required
                        />
                      </div>
                    </div>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => {
                          setAcceptTerms(e.target.checked);
                          if (createError) {
                            setCreateError(null);
                            setCreateErrorCode(null);
                          }
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-white/10 bg-black/20 text-ts-orange focus:ring-ts-orange/70/60"
                      />
                      <span className="text-xs text-white/60">Agree to Terms + Privacy.</span>
                    </label>
                    {createError && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                        <p
                          role="alert"
                          data-testid="signup-error"
                          className="text-xs text-destructive"
                        >
                          {createError}
                        </p>
                        {(createErrorCode === "AUTH_ACCOUNT_EXISTS" ||
                          createErrorCode === "AUTH_ACCOUNT_EXISTS_SOCIAL_ONLY") && (
                          <button
                            type="button"
                            className="mt-1 text-xs font-medium underline underline-offset-2 text-white"
                            onClick={() => setAuthModeAndSyncUrl("signin")}
                          >
                            Switch to sign in
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        data-testid="signup-submit"
                        disabled={authSubmitting}
                        className="h-9 bg-ts-orange text-white hover:bg-ts-orange/90"
                      >
                        {authSubmitting
                          ? "Creating..."
                          : isDirectConnectDestination
                            ? "Create account to continue"
                            : "Create account"}
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <a
                        href={`/pre-scout-setup?mode=signin${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`}
                        data-testid="have-account"
                        className="text-xs text-white/60 hover:text-white underline-offset-2 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          setAuthModeAndSyncUrl("signin");
                        }}
                      >
                        Already have an account? Sign in
                      </a>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHelmet
        title="Account Setup | TradeScout"
        description="Finish your TradeScout account setup."
        canonical="https://www.thetradescout.com/pre-scout-setup"
        noIndex
      />
      <div className="flex justify-center px-3 py-4 md:px-4 md:py-8 text-white">
        <div className="w-full max-w-2xl space-y-3">
          <Card className="rounded-2xl border border-white/10 bg-tsCard/95 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <CardHeader className="space-y-2">
              <div className="space-y-0.5">
                <div className="text-[11px] uppercase tracking-[0.15em] text-white/60">Routing</div>
                <CardTitle className="text-xl text-white">Opening onboarding</CardTitle>
                <p className="text-sm text-white/60">
                  Account access is ready. TradeScout is sending you into the main onboarding flow
                  so profile setup, local context, and first-use guidance all stay in one place.
                </p>
              </div>
            </CardHeader>

            <CardContent>
              <Button
                className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
                onClick={() => navigate(authenticatedNextPath)}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
