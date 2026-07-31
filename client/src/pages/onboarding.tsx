import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertCircle, Building2, Check, ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { uploadObject } from "@/lib/objectUpload";
import { storeOnboardingResultPrompt } from "@/lib/onboardingResultHandoff";
import { readPersistedOnboardingOutcomeRecovery } from "@/lib/onboardingOutcomeRecovery";
import {
  clearOutcomeOnboardingClaimContinuation,
  readOutcomeOnboardingClaimContinuation,
  storeOutcomeOnboardingClaimContinuation,
} from "@/lib/outcomeOnboardingClaimContinuation";
import {
  consumeOnboardingNext,
  getCurrentInternalPath,
  isSafeNextPath,
} from "@/lib/postOnboardingRoute";

type OnboardingKind = "business_profile" | "express_result";
type OnboardingResultKind = OnboardingKind | "business_claim_required";

type OnboardingCompleteResponse = {
  success: true;
  result: {
    kind: OnboardingResultKind;
    resultRoute: string;
    resultPrompt?: string;
    outcomeTitle?: string;
    profile?: {
      id: string;
      slug: string;
      businessId: string;
      saved: true;
      published: true;
      discovery: "verification_gated" | "eligible";
    };
    claim?: { businessId?: string; name: string; slug?: string };
  };
};

type PhotoState = "uploading" | "uploaded" | "error";

type PhotoItem = {
  id: string;
  name: string;
  previewUrl: string;
  publicUrl?: string;
  state: PhotoState;
  error?: string;
};

type OwnedBusinessCandidate = { id: string; name: string; slug: string };
type OwnedProfileCandidate = { id: string; displayName: string; slug: string };

const MAX_PROFILE_PHOTOS = 12;
const ONBOARDING_COMPLETION_TIMEOUT_MS = 130_000;
const MAX_BUSINESS_SERVICES = 50;
const MAX_BUSINESS_SERVICE_LENGTH = 180;
const MAX_BUSINESS_LINKS = 20;
const MAX_BUSINESS_LINK_LENGTH = 2_000;

function splitEvidenceList(value: string, maxItems: number, maxItemLength: number): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter((item) => Boolean(item) && item.length <= maxItemLength)
    )
  ).slice(0, maxItems);
}

function readOwnedBusinessCandidates(error: ApiError): OwnedBusinessCandidate[] {
  const candidates = Array.isArray(error.details?.candidates) ? error.details.candidates : [];
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const value = candidate as Record<string, unknown>;
    const id = typeof value.id === "string" ? value.id.trim() : "";
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const slug = typeof value.slug === "string" ? value.slug.trim() : "";
    return id && name ? [{ id, name, slug }] : [];
  });
}

function readOwnedProfileCandidates(error: ApiError): OwnedProfileCandidate[] {
  const candidates = Array.isArray(error.details?.candidates) ? error.details.candidates : [];
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const value = candidate as Record<string, unknown>;
    const id = typeof value.id === "string" ? value.id.trim() : "";
    const displayName = typeof value.displayName === "string" ? value.displayName.trim() : "";
    const slug = typeof value.slug === "string" ? value.slug.trim() : "";
    return id && displayName ? [{ id, displayName, slug }] : [];
  });
}

function readSafeNext(location: string): string | undefined {
  const query = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
  const next = new URLSearchParams(query).get("next")?.trim() || "";
  return isSafeNextPath(next) ? next : undefined;
}

export default function Onboarding() {
  const { user, refetch } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [claimContinuation] = useState(() => {
    const query = getCurrentInternalPath(location).split("?", 2)[1]?.split("#", 1)[0] || "";
    const resumeBusinessId = new URLSearchParams(query).get("resumeClaimedBusinessId") || "";
    const pending = readOutcomeOnboardingClaimContinuation();
    if (!pending || !resumeBusinessId) return null;
    if (pending.businessId && pending.businessId !== resumeBusinessId) return null;
    return { ...pending, businessId: resumeBusinessId };
  });
  const [safeNext] = useState<string | undefined>(() => {
    const queryNext = readSafeNext(getCurrentInternalPath(location));
    // Always consume the fallback so an older interruption cannot leak into a
    // later onboarding visit. The explicit query wins when both are present.
    const storedNext = consumeOnboardingNext();
    return (
      queryNext ||
      (claimContinuation?.next && isSafeNextPath(claimContinuation.next)
        ? claimContinuation.next
        : undefined) ||
      (storedNext && isSafeNextPath(storedNext) ? storedNext : undefined)
    );
  });

  const [goal, setGoal] = useState(() => claimContinuation?.goal || "");
  const [isBusiness, setIsBusiness] = useState(Boolean(claimContinuation));
  const [targetBusinessId, setTargetBusinessId] = useState(
    () => claimContinuation?.businessId || ""
  );
  const [targetProfileId, setTargetProfileId] = useState("");
  const [businessCandidates, setBusinessCandidates] = useState<OwnedBusinessCandidate[]>([]);
  const [profileCandidates, setProfileCandidates] = useState<OwnedProfileCandidate[]>([]);
  const [businessName, setBusinessName] = useState(() => claimContinuation?.business.name || "");
  const [businessNotes, setBusinessNotes] = useState(() => claimContinuation?.business.notes || "");
  const [servicesText, setServicesText] = useState(() =>
    (claimContinuation?.business.services || []).join("\n")
  );
  const [linksText, setLinksText] = useState(() =>
    (claimContinuation?.business.links || []).join("\n")
  );
  const [resumedPhotoUrls] = useState(() => claimContinuation?.business.photoUrls || []);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [goalError, setGoalError] = useState("");
  const [businessNameError, setBusinessNameError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [photoSelectionError, setPhotoSelectionError] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const businessNameRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef<PhotoItem[]>([]);
  const completionResponseHandledRef = useRef(false);

  useEffect(() => {
    if (completionResponseHandledRef.current) return;
    const recovery = readPersistedOnboardingOutcomeRecovery(user);
    if (!recovery) return;
    completionResponseHandledRef.current = true;
    if (recovery.resultPrompt) storeOnboardingResultPrompt(recovery.resultPrompt);
    navigate(recovery.resultRoute);
  }, [navigate, user]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(
    () => () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    },
    []
  );

  const isUploading = photos.some((photo) => photo.state === "uploading");
  const uploadedPhotoUrls = [
    ...resumedPhotoUrls,
    ...photos.flatMap((photo) =>
      photo.state === "uploaded" && photo.publicUrl ? [photo.publicUrl] : []
    ),
  ];

  const completeOnboarding = useMutation<OnboardingCompleteResponse, Error>({
    mutationFn: async () => {
      const trimmedGoal = goal.trim();
      if (!trimmedGoal) {
        throw new ApiError(t("onboarding.outcome.goalRequired"), {
          code: "ONBOARDING_GOAL_REQUIRED",
          status: 400,
        });
      }

      const kind: OnboardingKind = isBusiness ? "business_profile" : "express_result";
      const payload: {
        kind: OnboardingKind;
        goal: string;
        next?: string;
        business?: {
          targetBusinessId?: string;
          targetProfileId?: string;
          name?: string;
          notes?: string;
          services?: string[];
          links?: string[];
          photoUrls?: string[];
        };
      } = {
        kind,
        goal: trimmedGoal,
      };

      if (safeNext) payload.next = safeNext;

      if (isBusiness) {
        const name = businessName.trim();
        const notes = businessNotes.trim();
        const services = splitEvidenceList(
          servicesText,
          MAX_BUSINESS_SERVICES,
          MAX_BUSINESS_SERVICE_LENGTH
        );
        const links = splitEvidenceList(linksText, MAX_BUSINESS_LINKS, MAX_BUSINESS_LINK_LENGTH);
        payload.business = {
          ...(targetBusinessId ? { targetBusinessId } : {}),
          ...(targetProfileId ? { targetProfileId } : {}),
          ...(name ? { name } : {}),
          ...(notes ? { notes } : {}),
          ...(services.length ? { services } : {}),
          ...(links.length ? { links } : {}),
          ...(uploadedPhotoUrls.length ? { photoUrls: uploadedPhotoUrls } : {}),
        };
      }

      return apiRequest("/api/onboarding/complete", {
        method: "POST",
        body: payload,
        timeoutMs: ONBOARDING_COMPLETION_TIMEOUT_MS,
      });
    },
    onSuccess: async (response) => {
      completionResponseHandledRef.current = true;
      setSubmitError("");
      setBusinessNameError("");
      if (response?.result?.kind === "business_claim_required") {
        const businessId = String(response.result.claim?.businessId || "").trim();
        const resultRoute = String(response.result.resultRoute || "").trim();
        let claimQuery = "";
        try {
          claimQuery =
            new URL(resultRoute, "https://tradescout.internal").searchParams.get("q") || "";
        } catch {
          claimQuery = "";
        }
        if ((!businessId && !claimQuery) || !isSafeNextPath(resultRoute)) {
          setSubmitError(t("onboarding.outcome.submitError"));
          return;
        }
        const services = splitEvidenceList(
          servicesText,
          MAX_BUSINESS_SERVICES,
          MAX_BUSINESS_SERVICE_LENGTH
        );
        const links = splitEvidenceList(linksText, MAX_BUSINESS_LINKS, MAX_BUSINESS_LINK_LENGTH);
        storeOutcomeOnboardingClaimContinuation({
          ...(businessId ? { businessId } : { claimQuery }),
          goal: goal.trim(),
          ...(safeNext ? { next: safeNext } : {}),
          business: {
            ...(businessName.trim() ? { name: businessName.trim() } : {}),
            ...(businessNotes.trim() ? { notes: businessNotes.trim() } : {}),
            ...(services.length ? { services } : {}),
            ...(links.length ? { links } : {}),
            ...(uploadedPhotoUrls.length ? { photoUrls: uploadedPhotoUrls } : {}),
          },
        });
        navigate(resultRoute);
        return;
      }
      clearOutcomeOnboardingClaimContinuation();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      try {
        await refetch?.();
      } catch {
        // The completion response already owns the handoff. A background refresh
        // failure should not strand a person on onboarding.
      }

      const resultRoute = String(response?.result?.resultRoute || "").trim();
      if (response?.result?.kind === "express_result" && response.result.resultPrompt) {
        storeOnboardingResultPrompt(response.result.resultPrompt);
      }
      navigate(isSafeNextPath(resultRoute) ? resultRoute : "/scout");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "ONBOARDING_GOAL_REQUIRED") {
        setGoalError(t("onboarding.outcome.goalRequired"));
        return;
      }
      if (error instanceof ApiError && error.code === "BUSINESS_IDENTITY_REQUIRED") {
        setBusinessNameError(t("onboarding.outcome.businessNameRequired"));
        setSubmitError("");
        window.setTimeout(() => businessNameRef.current?.focus(), 0);
        return;
      }
      if (error instanceof ApiError && error.code === "BUSINESS_SELECTION_REQUIRED") {
        const candidates = readOwnedBusinessCandidates(error);
        setBusinessCandidates(candidates);
        setTargetBusinessId("");
        setBusinessNameError(candidates.length ? "" : error.message);
        setSubmitError("");
        if (!candidates.length) window.setTimeout(() => businessNameRef.current?.focus(), 0);
        return;
      }
      if (error instanceof ApiError && error.code === "BUSINESS_PROFILE_SELECTION_REQUIRED") {
        const candidates = readOwnedProfileCandidates(error);
        setProfileCandidates(candidates);
        setTargetProfileId("");
        setSubmitError(candidates.length ? "" : error.message);
        return;
      }
      void refetch?.();
      setSubmitError(error.message || t("onboarding.outcome.submitError"));
    },
  });

  const didResumeClaimRef = useRef(false);
  useEffect(() => {
    if (!claimContinuation || didResumeClaimRef.current) return;
    didResumeClaimRef.current = true;
    completeOnboarding.mutate();
  }, [claimContinuation]);

  const handlePhotosSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectedImages = Array.from(input.files || []).filter((file) =>
      file.type.startsWith("image/")
    );
    const remainingSlots = Math.max(0, MAX_PROFILE_PHOTOS - photos.length);
    const selectedFiles = selectedImages.slice(0, remainingSlots);
    input.value = "";
    setPhotoSelectionError(
      selectedImages.length > remainingSlots ? t("onboarding.outcome.photoLimit") : ""
    );
    if (!selectedFiles.length) return;

    const queued: PhotoItem[] = selectedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      state: "uploading",
    }));
    setPhotos((current) => [...current, ...queued]);

    await Promise.all(
      selectedFiles.map(async (file, index) => {
        const queuedPhoto = queued[index];
        try {
          const { publicUrl } = await uploadObject(file);
          setPhotos((current) =>
            current.map((photo) =>
              photo.id === queuedPhoto.id
                ? { ...photo, state: "uploaded", publicUrl, error: undefined }
                : photo
            )
          );
        } catch {
          setPhotos((current) =>
            current.map((photo) =>
              photo.id === queuedPhoto.id
                ? { ...photo, state: "error", error: t("onboarding.outcome.photoError") }
                : photo
            )
          );
        }
      })
    );
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    setBusinessNameError("");
    if (!goal.trim()) {
      setGoalError(t("onboarding.outcome.goalRequired"));
      return;
    }
    if (isBusiness && businessCandidates.length && !targetBusinessId) {
      setSubmitError(t("onboarding.outcome.businessSelectionRequired"));
      return;
    }
    if (isBusiness && profileCandidates.length && !targetProfileId) {
      setSubmitError(t("onboarding.outcome.profileSelectionRequired"));
      return;
    }
    setGoalError("");
    completeOnboarding.mutate();
  };

  const isProcessing = completeOnboarding.isPending;

  return (
    <main className="flex min-h-[calc(100vh-4rem)] justify-center px-3 py-6 text-white sm:px-5 sm:py-10">
      <div className="w-full max-w-2xl space-y-3">
        <div className="flex items-center justify-end">
          <LanguageSwitcher />
        </div>

        <Card className="border border-white/10 bg-tsCard shadow-2xl shadow-black/20">
          <CardHeader className="space-y-4 pb-4">
            <div className="flex items-center gap-2">
              <TradeScoutLogo size="xs" />
              <span className="text-xs uppercase tracking-[0.2em] text-white/60">TRADESCOUT</span>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-semibold text-white sm:text-3xl">
                {t("onboarding.outcome.title")}
              </CardTitle>
              <p className="max-w-xl text-sm leading-6 text-white/65">
                {t("onboarding.outcome.subtitle")}
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="onboarding-goal" className="text-sm font-medium text-white">
                  {t("onboarding.outcome.goalLabel")}
                </Label>
                <Textarea
                  id="onboarding-goal"
                  data-testid="onboarding-goal"
                  value={goal}
                  maxLength={2000}
                  onChange={(event) => {
                    setGoal(event.target.value);
                    if (event.target.value.trim()) setGoalError("");
                  }}
                  placeholder={t("onboarding.outcome.goalPlaceholder")}
                  aria-invalid={Boolean(goalError)}
                  aria-describedby={goalError ? "onboarding-goal-error" : "onboarding-goal-hint"}
                  className="min-h-28 resize-y border-white/15 bg-black/25 text-base text-white placeholder:text-white/35 focus-visible:ring-ts-orange"
                />
                {goalError ? (
                  <p id="onboarding-goal-error" role="alert" className="text-xs text-red-300">
                    {goalError}
                  </p>
                ) : (
                  <p id="onboarding-goal-hint" className="text-xs text-white/50">
                    {t("onboarding.outcome.goalHint")}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="business-switch" className="cursor-pointer text-sm text-white">
                      {t("onboarding.outcome.businessSwitch")}
                    </Label>
                    <p className="text-xs leading-5 text-white/50">
                      {t("onboarding.outcome.businessSwitchHint")}
                    </p>
                  </div>
                  <Switch
                    id="business-switch"
                    data-testid="business-switch"
                    checked={isBusiness}
                    onCheckedChange={(checked) => {
                      setIsBusiness(checked);
                      if (!checked) {
                        setTargetBusinessId("");
                        setTargetProfileId("");
                        setBusinessCandidates([]);
                        setProfileCandidates([]);
                      }
                      setBusinessNameError("");
                      setSubmitError("");
                    }}
                    aria-label={t("onboarding.outcome.businessSwitch")}
                    className="data-[state=checked]:bg-ts-orange"
                  />
                </div>
              </div>

              {isBusiness ? (
                <section
                  aria-labelledby="business-evidence-title"
                  className="space-y-5 rounded-xl border border-ts-orange/25 bg-ts-orange/5 p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-ts-orange/15 p-2 text-ts-orange">
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h2
                        id="business-evidence-title"
                        className="text-base font-semibold text-white"
                      >
                        {t("onboarding.outcome.businessTitle")}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-white/60">
                        {t("onboarding.outcome.businessEvidenceHint")}
                      </p>
                    </div>
                  </div>

                  {businessCandidates.length ? (
                    <div className="space-y-2 rounded-lg border border-amber-300/25 bg-amber-300/5 p-3">
                      <Label htmlFor="target-business" className="text-sm text-amber-100">
                        {t("onboarding.outcome.businessSelectionLabel")}
                      </Label>
                      <select
                        id="target-business"
                        data-testid="target-business"
                        value={targetBusinessId}
                        onChange={(event) => {
                          const id = event.target.value;
                          const selected = businessCandidates.find(
                            (candidate) => candidate.id === id
                          );
                          setTargetBusinessId(id);
                          setTargetProfileId("");
                          setProfileCandidates([]);
                          if (selected) setBusinessName(selected.name);
                          setSubmitError("");
                          setBusinessNameError("");
                        }}
                        className="h-10 w-full rounded-md border border-white/15 bg-black/50 px-3 text-sm text-white"
                      >
                        <option value="">
                          {t("onboarding.outcome.businessSelectionPlaceholder")}
                        </option>
                        {businessCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name}
                            {candidate.slug ? ` (${candidate.slug})` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs leading-5 text-amber-100/70">
                        {t("onboarding.outcome.businessSelectionHint")}
                      </p>
                    </div>
                  ) : null}

                  {profileCandidates.length ? (
                    <div className="space-y-2 rounded-lg border border-amber-300/25 bg-amber-300/5 p-3">
                      <Label htmlFor="target-profile" className="text-sm text-amber-100">
                        {t("onboarding.outcome.profileSelectionLabel")}
                      </Label>
                      <select
                        id="target-profile"
                        data-testid="target-profile"
                        value={targetProfileId}
                        onChange={(event) => {
                          setTargetProfileId(event.target.value);
                          setSubmitError("");
                        }}
                        className="h-10 w-full rounded-md border border-white/15 bg-black/50 px-3 text-sm text-white"
                      >
                        <option value="">
                          {t("onboarding.outcome.profileSelectionPlaceholder")}
                        </option>
                        {profileCandidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.displayName}
                            {candidate.slug ? ` (${candidate.slug})` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs leading-5 text-amber-100/70">
                        {t("onboarding.outcome.profileSelectionHint")}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="business-name" className="text-sm text-white/85">
                      {t("onboarding.outcome.businessNameLabel")}
                    </Label>
                    <Input
                      ref={businessNameRef}
                      id="business-name"
                      data-testid="business-name"
                      value={businessName}
                      maxLength={180}
                      onChange={(event) => {
                        setBusinessName(event.target.value);
                        setTargetBusinessId("");
                        setTargetProfileId("");
                        setBusinessCandidates([]);
                        setProfileCandidates([]);
                        if (event.target.value.trim()) setBusinessNameError("");
                      }}
                      placeholder={t("onboarding.outcome.businessNamePlaceholder")}
                      aria-invalid={Boolean(businessNameError)}
                      aria-describedby={businessNameError ? "business-name-error" : undefined}
                      className="border-white/15 bg-black/25 text-white placeholder:text-white/35"
                    />
                    {businessNameError ? (
                      <p id="business-name-error" role="alert" className="text-xs text-red-300">
                        {businessNameError}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="business-notes" className="text-sm text-white/85">
                      {t("onboarding.outcome.businessNotesLabel")}
                    </Label>
                    <Textarea
                      id="business-notes"
                      value={businessNotes}
                      maxLength={4000}
                      onChange={(event) => setBusinessNotes(event.target.value)}
                      placeholder={t("onboarding.outcome.businessNotesPlaceholder")}
                      className="min-h-24 border-white/15 bg-black/25 text-white placeholder:text-white/35"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="business-services" className="text-sm text-white/85">
                        {t("onboarding.outcome.servicesLabel")}
                      </Label>
                      <Textarea
                        id="business-services"
                        value={servicesText}
                        onChange={(event) => setServicesText(event.target.value)}
                        placeholder={t("onboarding.outcome.servicesPlaceholder")}
                        className="min-h-24 border-white/15 bg-black/25 text-white placeholder:text-white/35"
                      />
                      <p className="text-[11px] leading-5 text-white/45">
                        {t("onboarding.outcome.servicesHint")}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-links" className="text-sm text-white/85">
                        {t("onboarding.outcome.linksLabel")}
                      </Label>
                      <Textarea
                        id="business-links"
                        inputMode="url"
                        value={linksText}
                        onChange={(event) => {
                          setLinksText(event.target.value);
                          setTargetBusinessId("");
                          setTargetProfileId("");
                          setBusinessCandidates([]);
                          setProfileCandidates([]);
                          setSubmitError("");
                        }}
                        placeholder={t("onboarding.outcome.linksPlaceholder")}
                        className="min-h-24 border-white/15 bg-black/25 text-white placeholder:text-white/35"
                      />
                      <p className="text-[11px] leading-5 text-white/45">
                        {t("onboarding.outcome.linksHint")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm text-white/85">
                        {t("onboarding.outcome.photosLabel")}
                      </Label>
                      <p className="mt-1 text-xs text-white/50">
                        {t("onboarding.outcome.photosHint")}
                      </p>
                    </div>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={handlePhotosSelected}
                      data-testid="business-photos"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isProcessing}
                      className="border-white/15 bg-black/20 text-white hover:bg-white/10"
                    >
                      <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("onboarding.outcome.addPhotos")}
                    </Button>
                    {photoSelectionError ? (
                      <p role="alert" className="text-xs text-amber-200">
                        {photoSelectionError}
                      </p>
                    ) : null}

                    {photos.length ? (
                      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-live="polite">
                        {photos.map((photo) => (
                          <li
                            key={photo.id}
                            className="overflow-hidden rounded-lg border border-white/10 bg-black/30"
                          >
                            <div className="relative aspect-[4/3]">
                              <img
                                src={photo.previewUrl}
                                alt={photo.name}
                                className="h-full w-full object-cover"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removePhoto(photo.id)}
                                disabled={isProcessing}
                                aria-label={`${t("onboarding.outcome.removePhoto")}: ${photo.name}`}
                                className="absolute right-1 top-1 h-8 w-8 bg-black/70 text-white hover:bg-black"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                            <div className="flex min-h-10 items-center gap-2 px-2 py-2 text-[11px]">
                              {photo.state === "uploading" ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-ts-orange" />
                                  <span className="text-white/65">
                                    {t("onboarding.outcome.uploadingPhoto")}
                                  </span>
                                </>
                              ) : photo.state === "uploaded" ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                                  <span className="text-white/65">
                                    {t("onboarding.outcome.photoReady")}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-3.5 w-3.5 text-red-300" />
                                  <span className="text-red-200">{photo.error}</span>
                                </>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-3 text-xs leading-5 text-white/55">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ts-orange" />
                      <p>{t("onboarding.outcome.groundingNotice")}</p>
                    </div>
                  </div>
                </section>
              ) : null}

              {submitError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-3 text-sm text-red-100"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{submitError}</span>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-white/45">
                  {isBusiness
                    ? t("onboarding.outcome.businessCompletionHint")
                    : t("onboarding.outcome.expressCompletionHint")}
                </p>
                <Button
                  type="submit"
                  disabled={isProcessing || isUploading}
                  className="min-w-36 bg-ts-orange text-black hover:bg-ts-orange/90"
                  data-testid="complete-onboarding"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      {t("onboarding.outcome.uploading")}
                    </>
                  ) : isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      {t("onboarding.outcome.processing")}
                    </>
                  ) : isBusiness ? (
                    t("onboarding.outcome.buildProfile")
                  ) : (
                    t("onboarding.outcome.getResult")
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
