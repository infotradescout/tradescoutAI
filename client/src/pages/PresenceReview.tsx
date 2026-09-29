import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { readAuthSessionUser } from "@/lib/authSessionRead";
import { buildAuthEntryRoute } from "@/lib/postOnboardingRoute";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PresenceFactReview from "./PresenceFactReview";
import {
  resolvePresenceReviewContext,
  presenceEvidenceLabel,
  presenceRecommendationLabel,
  safePresenceSourceHref,
  type OwnedPresenceProfile,
  type PresenceReviewRecord,
  type PresenceSitePath,
} from "@/lib/presenceReview";

const REVIEW_PATH = "/presence/review";
const SIGN_IN_PATH = buildAuthEntryRoute({ mode: "signin", next: REVIEW_PATH });

function requestedFactReview(): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("section") === "facts"
  );
}

const SITE_CHOICES: Record<PresenceSitePath, { title: string; description: string }> = {
  hosted_new: {
    title: "Build a new TradeScout site",
    description: "Start with a new site connected to your TradeScout business profile.",
  },
  keep_external: {
    title: "Keep my current website",
    description: "Keep your existing website and connect it with your TradeScout profile.",
  },
  preserve_migrate: {
    title: "Explore a careful website move",
    description: "Prepare a comparison of your existing pages before any move is considered.",
  },
};

const ACTION_LABELS: Record<string, string> = {
  "profile.review": "Business profile",
  "site.prepare": "Website preparation",
  "domain.select_register": "Domain selection",
  "domain.connect": "Domain connection",
  "google_business.claim_configure": "Google Business",
  "reviews.configure": "Reviews",
  "analytics.configure": "Analytics",
  "social.configure": "Social accounts",
  "direct_connect.configure": "Direct Connect",
  "migration.shadow_clone_verify": "Website move comparison",
};

const QUARANTINE_REASONS: Record<string, string> = {
  missing_onboarding_evidence: "More business information is needed.",
  unsupported_evidence_shape: "This information needs another look.",
  identity_conflict: "Business identity details disagree.",
  requires_owner_confirmation: "Please check this detail in your profile editor.",
  missing_source_reference: "No supporting source was saved for this detail.",
  invalid_source_url: "A source link could not be used.",
  invalid_existing_website: "The saved website address needs correction.",
};

type ReadyState = {
  kind: "ready";
  record: PresenceReviewRecord;
  profile: OwnedPresenceProfile;
  notice?: string;
};
type ViewState =
  | ReadyState
  | { kind: "loading" | "sign_in" | "blocked" | "onboarding" | "impersonating" | "unavailable" }
  | { kind: "identity_conflict"; editorHref: string; ownerUserId: string };

function errorStatus(error: unknown): { status: number | undefined; code: string | undefined } {
  return error instanceof ApiError
    ? { status: error.status, code: error.code }
    : {
        status: undefined,
        code: undefined,
      };
}

function safeEditorHref(profile: OwnedPresenceProfile): string {
  return `/u/${encodeURIComponent(profile.slug)}/edit`;
}

function isImpersonating(user: Record<string, unknown>): boolean {
  return user.isImpersonating === true || user.impersonating === true;
}

function StatusCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-white/10 bg-tsCard text-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-white/70">{children}</CardContent>
    </Card>
  );
}

export default function PresenceReview() {
  const { user: cachedUser, isLoading: authLoading } = useAuth();
  const cachedUserId = typeof cachedUser?.id === "string" ? cachedUser.id : "";
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [choice, setChoice] = useState<PresenceSitePath | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showFacts, setShowFacts] = useState(false);
  const runId = useRef(0);
  const saveInFlight = useRef(false);
  const cachedUserIdRef = useRef(cachedUserId);
  cachedUserIdRef.current = cachedUserId;

  const load = useCallback(
    async (forceRefresh = false, notice?: string) => {
      const run = ++runId.current;
      setView({ kind: "loading" });
      setChoice(null);
      setSaved(false);
      setShowFacts(requestedFactReview());
      setSaving(false);
      saveInFlight.current = false;
      const current = () => run === runId.current;
      try {
        const freshUser = await readAuthSessionUser(buildApiUrl("/api/auth/user"));
        if (!current()) return;
        if (!freshUser) return setView({ kind: "sign_in" });
        if (isImpersonating(freshUser)) return setView({ kind: "impersonating" });
        if (!cachedUserId || freshUser.id !== cachedUserId) return setView({ kind: "blocked" });

        const [firstResponse, profiles] = await Promise.all([
          forceRefresh ? Promise.resolve(null) : apiRequest("GET", "/api/presence/plan"),
          apiRequest("GET", "/api/profiles"),
        ]);
        if (!current()) return;
        let response = firstResponse;
        if (forceRefresh || !response?.plan || response.plan.status === "stale") {
          await apiRequest("POST", "/api/presence/plan/refresh");
          response = await apiRequest("GET", "/api/presence/plan");
        }
        if (!current()) return;
        const resolved = resolvePresenceReviewContext(response?.plan, profiles, freshUser.id);
        if (!resolved) return setView({ kind: "blocked" });
        if (
          resolved.record.plan.quarantinedEvidence.some(
            (item) => item.reason === "identity_conflict"
          ) ||
          resolved.record.plan.sitePath.allowed.length === 0
        ) {
          return setView({
            kind: "identity_conflict",
            editorHref: safeEditorHref(resolved.profile),
            ownerUserId: resolved.profile.ownerUserId,
          });
        }
        setView({ kind: "ready", ...resolved, ...(notice ? { notice } : {}) });
      } catch (error) {
        if (!current()) return;
        const { status, code } = errorStatus(error);
        if (status === 401) setView({ kind: "sign_in" });
        else if (status === 403) setView({ kind: "blocked" });
        else if (status === 409 && code === "COMPLETED_BUSINESS_ONBOARDING_REQUIRED") {
          setView({ kind: "onboarding" });
        } else if (status === 409 && code === "PRESENCE_IMPERSONATION_REVIEW_UNAVAILABLE") {
          setView({ kind: "impersonating" });
        } else setView({ kind: "unavailable" });
      }
    },
    [cachedUserId]
  );

  useEffect(() => {
    if (!authLoading) void load();
    return () => {
      runId.current += 1;
      saveInFlight.current = false;
    };
  }, [authLoading, load]);

  const saveChoice = async () => {
    if (
      view.kind !== "ready" ||
      view.profile.ownerUserId !== cachedUserId ||
      !choice ||
      saveInFlight.current
    )
      return;
    const generation = runId.current;
    const ownerUserId = cachedUserId;
    const current = () => generation === runId.current && cachedUserIdRef.current === ownerUserId;
    saveInFlight.current = true;
    setSaving(true);
    setSaved(false);
    const { record, profile } = view;
    try {
      const freshUser = await readAuthSessionUser(buildApiUrl("/api/auth/user"));
      if (!current()) return;
      if (!freshUser) return setView({ kind: "sign_in" });
      if (isImpersonating(freshUser)) return setView({ kind: "impersonating" });
      if (!cachedUserId || freshUser.id !== cachedUserId || profile.ownerUserId !== freshUser.id) {
        return setView({ kind: "blocked" });
      }
      const response = await apiRequest("POST", "/api/presence/plan/review", {
        expectedDigest: record.evidenceDigest,
        expectedPlanHash: record.planHash,
        expectedRevision: record.revision,
        sitePath: choice,
      });
      if (!current()) return;
      const resolved = resolvePresenceReviewContext(response?.plan, [profile], freshUser.id);
      if (
        !resolved ||
        resolved.record.status !== "site_path_selected" ||
        resolved.record.selectedSitePath !== choice ||
        resolved.record.planHash !== record.planHash ||
        resolved.record.evidenceDigest !== record.evidenceDigest
      ) {
        return setView({ kind: "blocked" });
      }
      setView({ kind: "ready", ...resolved });
      setChoice(null);
      setSaved(true);
    } catch (error) {
      if (!current()) return;
      setChoice(null);
      const { status, code } = errorStatus(error);
      if (status === 401) setView({ kind: "sign_in" });
      else if (status === 403) setView({ kind: "blocked" });
      else if (code === "PRESENCE_IMPERSONATION_REVIEW_UNAVAILABLE") {
        setView({ kind: "impersonating" });
      } else if (status === 409 && code === "COMPLETED_BUSINESS_ONBOARDING_REQUIRED") {
        setView({ kind: "onboarding" });
      } else if (status === 422 && code === "PRESENCE_IDENTITY_CONFLICT") {
        setView({
          kind: "identity_conflict",
          editorHref: safeEditorHref(profile),
          ownerUserId: profile.ownerUserId,
        });
      } else if (
        (status === 409 && code === "PRESENCE_PLAN_STALE") ||
        (status === 422 && code === "SITE_PATH_UNAVAILABLE")
      ) {
        await load(true, "Business details changed. Choose a website approach again.");
      } else setView({ kind: "unavailable" });
    } finally {
      if (current()) {
        saveInFlight.current = false;
        setSaving(false);
      }
    }
  };

  const visibleView: ViewState =
    (view.kind === "ready" && view.profile.ownerUserId !== cachedUserId) ||
    (view.kind === "identity_conflict" && view.ownerUserId !== cachedUserId)
      ? { kind: "blocked" }
      : view;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 text-white sm:px-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-ts-orange">
          Business presence
        </p>
        <h1 className="text-3xl font-bold">Choose your website approach</h1>
        <p className="text-sm text-white/65">
          This step records your preference. Other setup work is handled separately.
        </p>
      </header>

      {visibleView.kind === "loading" ? <p role="status">Checking your business setup…</p> : null}
      {visibleView.kind === "sign_in" ? (
        <StatusCard title="Sign in to continue">
          <p>Your session needs to be checked before you can review a website approach.</p>
          <Button asChild>
            <Link href={SIGN_IN_PATH}>Sign in</Link>
          </Button>
        </StatusCard>
      ) : null}
      {visibleView.kind === "blocked" ? (
        <StatusCard title="Business review unavailable">
          <p>We could not match this business and profile to your current account.</p>
        </StatusCard>
      ) : null}
      {visibleView.kind === "onboarding" ? (
        <StatusCard title="Set up a business profile first">
          <p>Finish the business setup in your own account before choosing a website approach.</p>
          <Button asChild>
            <Link href="/onboarding">Go to onboarding</Link>
          </Button>
        </StatusCard>
      ) : null}
      {visibleView.kind === "impersonating" ? (
        <StatusCard title="Owner action unavailable">
          <p role="alert">
            You are acting as another user. End impersonation before choosing a website approach.
          </p>
        </StatusCard>
      ) : null}
      {visibleView.kind === "unavailable" ? (
        <StatusCard title="Could not load this review">
          <p>Please try again. No website approach was recorded from this attempt.</p>
          <Button type="button" onClick={() => void load()} data-testid="presence-review-retry">
            Try again
          </Button>
        </StatusCard>
      ) : null}
      {visibleView.kind === "identity_conflict" ? (
        <StatusCard title="Business information needs correction">
          <p>
            Review your business profile details, then return here to choose a website approach.
          </p>
          <Button asChild>
            <Link href={visibleView.editorHref}>Open profile editor</Link>
          </Button>
        </StatusCard>
      ) : null}

      {visibleView.kind === "ready" ? (
        <>
          <Card
            className="border-white/10 bg-tsCard text-white"
            data-testid="presence-review-content"
          >
            <CardHeader>
              <CardTitle>{visibleView.profile.displayName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {visibleView.notice ? (
                <p role="status" className="text-amber-200">
                  {visibleView.notice}
                </p>
              ) : null}
              {saved ? (
                <p role="status" data-testid="presence-review-saved" className="text-emerald-300">
                  Website approach saved
                </p>
              ) : null}
              {visibleView.record.status === "site_path_selected" &&
              visibleView.record.selectedSitePath ? (
                <p className="text-sm text-white/70">
                  Current approach: {SITE_CHOICES[visibleView.record.selectedSitePath].title}
                </p>
              ) : null}
              <fieldset className="space-y-3" disabled={saving}>
                <legend className="mb-3 text-lg font-semibold">
                  Which approach fits your business?
                </legend>
                {visibleView.record.plan.sitePath.allowed.map((path) => (
                  <label
                    key={path}
                    className="flex cursor-pointer gap-3 rounded-xl border border-white/15 p-4 hover:border-white/35"
                  >
                    <input
                      type="radio"
                      name="presence-site-path"
                      value={path}
                      checked={choice === path}
                      onChange={() => {
                        setChoice(path);
                        setSaved(false);
                      }}
                      className="mt-1 accent-orange-500"
                      data-testid={`presence-choice-${path}`}
                    />
                    <span className="space-y-1">
                      <span className="block font-medium">{SITE_CHOICES[path].title}</span>
                      <span className="block text-sm text-white/60">
                        {SITE_CHOICES[path].description}
                      </span>
                      {visibleView.record.plan.sitePath.recommended === path &&
                      presenceRecommendationLabel(visibleView.record.plan.sitePath.reason, path) ? (
                        <span className="block text-xs text-amber-200">
                          {presenceRecommendationLabel(
                            visibleView.record.plan.sitePath.reason,
                            path
                          )}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </fieldset>
              <Button
                type="button"
                disabled={!choice || saving}
                onClick={() => void saveChoice()}
                data-testid="presence-review-save"
              >
                {saving ? "Saving…" : "Save website approach"}
              </Button>
              <p className="text-xs text-white/55">
                This choice does not change your website, domain, public profile, or outside
                accounts.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {!showFacts ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFacts(true)}
                data-testid="presence-open-fact-review"
              >
                Review imported business details
              </Button>
            ) : (
              <PresenceFactReview
                record={visibleView.record}
                profile={visibleView.profile}
                ownerUserId={cachedUserId}
              />
            )}
          </div>

          <Card className="border-white/10 bg-tsCard text-white">
            <CardHeader>
              <CardTitle>Details still to review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-white/65">
              <p>
                These references and flags are background information. No source detail is accepted
                by choosing a website approach.
              </p>
              {visibleView.record.plan.evidenceSources.length ? (
                <div>
                  <h2 className="font-semibold text-white">Source references</h2>
                  <ul className="mt-2 space-y-2">
                    {visibleView.record.plan.evidenceSources.map((item, index) => {
                      const href = safePresenceSourceHref(item.sourceRef);
                      return (
                        <li key={`${item.path}-${index}`} className="break-all">
                          <span className="block text-xs text-white/50">
                            {presenceEvidenceLabel(item.path)}
                          </span>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              {href}
                            </a>
                          ) : (
                            <span>Source link unavailable</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p>No source references were saved for this plan.</p>
              )}
              {visibleView.record.plan.quarantinedEvidence.length ? (
                <div>
                  <h2 className="font-semibold text-white">Items needing attention</h2>
                  <ul className="mt-2 space-y-2">
                    {visibleView.record.plan.quarantinedEvidence.map((item, index) => (
                      <li key={`${item.path}-${index}`}>
                        <span>
                          {QUARANTINE_REASONS[item.reason] || "This detail needs another look."}
                        </span>
                        <span className="block text-xs text-white/50">
                          {presenceEvidenceLabel(item.path)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={safeEditorHref(visibleView.profile)}
                    className="inline-block underline"
                  >
                    Review profile details
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <details className="rounded-xl border border-white/10 bg-tsCard p-5 text-sm text-white/70">
            <summary className="cursor-pointer font-semibold text-white">
              Other setup steps and their gates
            </summary>
            <p className="mt-3">These are planning notes. No step runs from this page.</p>
            <ul className="mt-4 space-y-3">
              {visibleView.record.plan.actions.map((action) => (
                <li key={action.id} className="rounded-lg border border-white/10 p-3">
                  <strong className="text-white">{ACTION_LABELS[action.id] || action.id}</strong>
                  <span className="ml-2 text-xs">
                    {action.adapterAvailability === "existing"
                      ? "Existing TradeScout feature"
                      : action.adapterAvailability === "planned"
                        ? "Planned work"
                        : "No connected adapter"}
                  </span>
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {action.requiredGates.map((gate) => (
                      <li key={`${gate.role}-${gate.gate}`}>
                        {gate.role === "Business Owner" ? "Business owner" : "TradeScout owner"}:{" "}
                        {gate.gate.replaceAll("_", " ")}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </main>
  );
}
