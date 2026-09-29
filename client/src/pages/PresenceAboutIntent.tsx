import { useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { readAuthSessionUser } from "@/lib/authSessionRead";
import {
  safeFactSourceHref,
  type PresenceFact,
  type PresenceFactReview,
} from "@/lib/presenceFacts";
import type { OwnedPresenceProfile } from "@/lib/presenceReview";
import { Button } from "@/components/ui/button";

type RefusalReason =
  | "NO_APPROVED_ABOUT"
  | "ABOUT_BLOCK_MISSING"
  | "ABOUT_BLOCK_MULTIPLE"
  | "ABOUT_BLOCK_UNSUPPORTED"
  | "ABOUT_HIDDEN"
  | "UNSUPPORTED_TEMPLATE"
  | "UNSUPPORTED_SITE_PATH";
type IntentStatus = "active" | "withdrawn" | "expired" | "stale";
type AboutIntent = {
  id: string;
  authorizedAt: string;
  expiresAt: string;
  status: IntentStatus;
  publicationApplied: false;
};
type AboutPreview = {
  eligible: boolean;
  reason: RefusalReason | null;
  plan: {
    id: string;
    businessId: string;
    profileId: string;
    revision: number;
    evidenceDigest: string;
    planHash: string;
    sitePath: "hosted_new" | "preserve_migrate" | "keep_external" | null;
  };
  fact: null | {
    key: "about";
    value: string;
    valueDigest: string;
    sourceRefs: string[];
    sourceVerificationLimited: boolean;
    decisionId: string;
    decisionEpoch: number;
    approvedAt: string;
  };
  target: null | {
    currentText: string;
    contentBlocksDigest: string;
    aboutBlockDigest: string;
    aboutBlockId: string;
    field: "text" | "description" | "body";
  };
  previewDigest: string | null;
  replacementRequired: boolean;
  intent: AboutIntent | null;
  publicationApplied: false;
};
type State =
  | {
      kind:
        | "idle"
        | "loading"
        | "stale"
        | "error"
        | "blocked"
        | "sign_in"
        | "impersonating"
        | "origin_required";
    }
  | { kind: "ready"; preview: AboutPreview; notice?: string };

const DIGEST = /^[a-f0-9]{64}$/;
const REASONS: Record<RefusalReason, string> = {
  NO_APPROVED_ABOUT:
    "The imported About detail needs your approval before a request can be previewed.",
  ABOUT_BLOCK_MISSING:
    "This profile has no single existing About section that can be safely replaced.",
  ABOUT_BLOCK_MULTIPLE:
    "This profile has multiple About sections, so TradeScout cannot safely choose one to replace.",
  ABOUT_BLOCK_UNSUPPORTED: "This About section uses a format this request cannot safely update.",
  ABOUT_HIDDEN: "This profile's About section is hidden, so this request is unavailable.",
  UNSUPPORTED_TEMPLATE: "This profile uses a website design this About request does not support.",
  UNSUPPORTED_SITE_PATH:
    "This website approach does not support a TradeScout About replacement request.",
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

/** A preview is shown only for the exact approved About fact and owned plan on this page. */
export function resolvePresenceAboutPreview(
  candidate: unknown,
  review: PresenceFactReview,
  profile: OwnedPresenceProfile,
  fact: PresenceFact
): AboutPreview | null {
  const preview = object(candidate);
  const plan = object(preview?.plan);
  const proposed = object(preview?.fact);
  const target = object(preview?.target);
  const intent = object(preview?.intent);
  if (
    !preview ||
    !plan ||
    fact.factKey !== "about" ||
    fact.decision !== "approve" ||
    plan.id !== review.planId ||
    plan.businessId !== review.businessId ||
    plan.businessId !== profile.businessId ||
    plan.profileId !== review.profileId ||
    plan.profileId !== profile.id ||
    plan.revision !== review.revision ||
    plan.evidenceDigest !== review.evidenceDigest ||
    plan.planHash !== review.planHash ||
    ![null, "hosted_new", "preserve_migrate", "keep_external"].includes(
      plan.sitePath as string | null
    ) ||
    preview.publicationApplied !== false ||
    typeof preview.eligible !== "boolean" ||
    typeof preview.replacementRequired !== "boolean" ||
    (preview.reason !== null && !Object.hasOwn(REASONS, String(preview.reason)))
  )
    return null;
  if (
    intent &&
    (typeof intent.id !== "string" ||
      !intent.id ||
      !validDate(intent.authorizedAt) ||
      !validDate(intent.expiresAt) ||
      !["active", "withdrawn", "expired", "stale"].includes(String(intent.status)) ||
      intent.publicationApplied !== false)
  )
    return null;
  if (preview.intent !== null && !intent) return null;
  if (!preview.eligible) {
    return preview.reason !== null && preview.previewDigest === null
      ? (candidate as AboutPreview)
      : null;
  }
  if (
    preview.reason !== null ||
    !proposed ||
    !target ||
    !validDigest(preview.previewDigest) ||
    (plan.sitePath !== "hosted_new" && plan.sitePath !== "preserve_migrate") ||
    proposed.key !== "about" ||
    proposed.value !== fact.value ||
    proposed.valueDigest !== fact.valueDigest ||
    typeof proposed.decisionId !== "string" ||
    !proposed.decisionId ||
    !Number.isSafeInteger(proposed.decisionEpoch) ||
    Number(proposed.decisionEpoch) < 1 ||
    !validDate(proposed.approvedAt) ||
    typeof proposed.sourceVerificationLimited !== "boolean" ||
    !Array.isArray(proposed.sourceRefs) ||
    proposed.sourceRefs.length === 0 ||
    !proposed.sourceRefs.every((source) => safeFactSourceHref(source) !== null) ||
    typeof target.currentText !== "string" ||
    target.currentText.length > 4_000 ||
    !validDigest(target.contentBlocksDigest) ||
    !validDigest(target.aboutBlockDigest) ||
    typeof target.aboutBlockId !== "string" ||
    !target.aboutBlockId ||
    !["text", "description", "body"].includes(String(target.field)) ||
    (target.currentText.trim().length > 0 && preview.replacementRequired !== true)
  )
    return null;
  return candidate as AboutPreview;
}

function isImpersonating(user: Record<string, unknown>): boolean {
  return user.isImpersonating === true || user.impersonating === true;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function intentFromResponse(candidate: unknown, status: IntentStatus): AboutIntent | null {
  const intent = object(candidate);
  return intent &&
    typeof intent.id === "string" &&
    Boolean(intent.id) &&
    validDate(intent.authorizedAt) &&
    validDate(intent.expiresAt) &&
    intent.status === status &&
    intent.publicationApplied === false
    ? (intent as AboutIntent)
    : null;
}

export default function PresenceAboutIntent({
  review,
  profile,
  fact,
  ownerUserId,
}: {
  review: PresenceFactReview;
  profile: OwnedPresenceProfile;
  fact: PresenceFact;
  ownerUserId: string;
}) {
  const identity = [
    ownerUserId,
    profile.ownerUserId,
    profile.id,
    profile.businessId,
    review.planId,
    review.businessId,
    review.profileId,
    review.revision,
    review.evidenceDigest,
    review.planHash,
    fact.factKey,
    fact.valueDigest,
    fact.decision,
  ].join(":");
  const [view, setView] = useState<{ identity: string; state: State }>({
    identity,
    state: { kind: "idle" },
  });
  const [ack, setAck] = useState({ identity, value: false });
  const [savingValue, setSavingValue] = useState({ identity, value: false });
  const state: State = view.identity === identity ? view.state : { kind: "idle" };
  const acknowledged = ack.identity === identity && ack.value;
  const saving = savingValue.identity === identity && savingValue.value;
  const setState = (next: State) => setView({ identity, state: next });
  const setAcknowledged = (next: boolean) => setAck({ identity, value: next });
  const setSaving = (next: boolean) => setSavingValue({ identity, value: next });
  const runId = useRef(0);
  const inFlight = useRef(false);
  const identityRef = useRef(identity);
  const idempotencyKeys = useRef(new Map<string, string>());
  identityRef.current = identity;

  useEffect(() => {
    runId.current += 1;
    inFlight.current = false;
    idempotencyKeys.current.clear();
    setView({ identity, state: { kind: "idle" } });
    setAck({ identity, value: false });
    setSavingValue({ identity, value: false });
    return () => {
      runId.current += 1;
      inFlight.current = false;
    };
  }, [identity]);

  const freshOwner = async (): Promise<"ok" | "sign_in" | "impersonating" | "blocked"> => {
    const user = await readAuthSessionUser(buildApiUrl("/api/auth/user"));
    if (!user) return "sign_in";
    if (isImpersonating(user)) return "impersonating";
    return user.id === ownerUserId && profile.ownerUserId === ownerUserId ? "ok" : "blocked";
  };

  const loadPreview = async (expected?: {
    intentId: string;
    status: IntentStatus;
    notice: string;
  }): Promise<boolean> => {
    const run = ++runId.current;
    const current = () => run === runId.current && identityRef.current === identity;
    setAcknowledged(false);
    setState({ kind: "loading" });
    try {
      const access = await freshOwner();
      if (!current()) return false;
      if (access !== "ok") {
        setState({ kind: access });
        return false;
      }
      const response = await apiRequest("GET", "/api/presence/about/preview");
      if (!current()) return false;
      const preview = resolvePresenceAboutPreview(response?.preview, review, profile, fact);
      if (!preview) {
        setState({ kind: "stale" });
        return false;
      }
      if (
        expected &&
        (preview.intent?.id !== expected.intentId || preview.intent.status !== expected.status)
      ) {
        setState({ kind: "stale" });
        return false;
      }
      setState({ kind: "ready", preview, ...(expected ? { notice: expected.notice } : {}) });
      return true;
    } catch (error) {
      if (!current()) return false;
      if (error instanceof ApiError && error.status === 401) setState({ kind: "sign_in" });
      else if (error instanceof ApiError && error.status === 403) setState({ kind: "blocked" });
      else if (
        error instanceof ApiError &&
        error.code === "PRESENCE_IMPERSONATION_ABOUT_UNAVAILABLE"
      )
        setState({ kind: "impersonating" });
      else if (error instanceof ApiError && error.status === 409) setState({ kind: "stale" });
      else setState({ kind: "error" });
      return false;
    }
  };

  const saveIntent = async (action: "authorize" | "withdraw") => {
    if (state.kind !== "ready" || inFlight.current) return;
    const preview = state.preview;
    const activeIntent = preview.intent?.status === "active" ? preview.intent : null;
    if (
      action === "authorize" &&
      (!preview.eligible ||
        !preview.fact ||
        !preview.target ||
        !preview.previewDigest ||
        activeIntent ||
        (preview.replacementRequired && !acknowledged))
    )
      return;
    if (action === "withdraw" && !activeIntent) return;
    const run = runId.current;
    const current = () => run === runId.current && identityRef.current === identity;
    inFlight.current = true;
    setSaving(true);
    try {
      const access = await freshOwner();
      if (!current()) return;
      if (access !== "ok") return setState({ kind: access });
      const attemptTarget = action === "withdraw" ? activeIntent?.id : preview.previewDigest;
      if (!attemptTarget) return;
      const attempt = `${action}:${attemptTarget}`;
      let idempotencyKey = idempotencyKeys.current.get(attempt);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        idempotencyKeys.current.set(attempt, idempotencyKey);
      }
      let response;
      if (action === "withdraw") {
        if (!activeIntent) return;
        response = await apiRequest("POST", "/api/presence/about/intent/withdraw", {
          intentId: activeIntent.id,
          idempotencyKey,
        });
      } else {
        const approvedFact = preview.fact;
        const target = preview.target;
        if (!approvedFact || !target || !preview.previewDigest) return;
        response = await apiRequest("POST", "/api/presence/about/intent", {
          expectedPlanId: review.planId,
          expectedProfileId: review.profileId,
          expectedRevision: review.revision,
          expectedDigest: review.evidenceDigest,
          expectedPlanHash: review.planHash,
          decisionId: approvedFact.decisionId,
          valueDigest: approvedFact.valueDigest,
          contentBlocksDigest: target.contentBlocksDigest,
          aboutBlockDigest: target.aboutBlockDigest,
          aboutBlockId: target.aboutBlockId,
          previewDigest: preview.previewDigest,
          replacementAcknowledged: acknowledged,
          idempotencyKey,
        });
      }
      if (!current()) return;
      const expectedStatus = action === "withdraw" ? "withdrawn" : "active";
      const confirmed = intentFromResponse(response?.intent, expectedStatus);
      if (!confirmed) return setState({ kind: "error" });
      inFlight.current = false;
      setSaving(false);
      const reloaded = await loadPreview({
        intentId: confirmed.id,
        status: expectedStatus,
        notice:
          action === "withdraw"
            ? "Your About request was withdrawn. TradeScout profile content is unchanged; no public change was made."
            : "Your deferred About authorization was saved. TradeScout profile content is unchanged; no public change was made.",
      });
      if (reloaded) idempotencyKeys.current.delete(attempt);
    } catch (error) {
      if (!current()) return;
      if (error instanceof ApiError && error.status === 401) setState({ kind: "sign_in" });
      else if (error instanceof ApiError && error.code === "PRESENCE_ABOUT_ORIGIN_REQUIRED")
        setState({ kind: "origin_required" });
      else if (error instanceof ApiError && error.status === 403) setState({ kind: "blocked" });
      else if (
        error instanceof ApiError &&
        error.code === "PRESENCE_IMPERSONATION_ABOUT_UNAVAILABLE"
      )
        setState({ kind: "impersonating" });
      else if (error instanceof ApiError && (error.status === 409 || error.status === 422))
        setState({ kind: "stale" });
      else setState({ kind: "error" });
    } finally {
      if (current()) {
        inFlight.current = false;
        setSaving(false);
      }
    }
  };

  const preview = state.kind === "ready" ? state.preview : null;
  const activeIntent = preview?.intent?.status === "active" ? preview.intent : null;
  return (
    <section
      className="space-y-3 rounded-lg border border-white/15 p-4"
      data-testid="presence-about-intent"
    >
      <h3 className="font-semibold">About change request</h3>
      <p className="text-sm text-white/65">
        Your approval of the imported About detail did not change your profile. Preview a separate,
        time-limited request to use it on your TradeScout profile. This request does not publish or
        schedule a public change.
      </p>
      {state.kind === "idle" || state.kind === "stale" || state.kind === "error" ? (
        <Button type="button" variant="outline" onClick={() => void loadPreview()}>
          {state.kind === "idle" ? "Preview About request" : "Preview again"}
        </Button>
      ) : null}
      {state.kind === "loading" ? <p role="status">Loading current About…</p> : null}
      {state.kind === "stale" ? (
        <p role="alert">
          The approved detail or current About changed. Preview again before saving a request.
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p role="alert">The About request could not be confirmed. Preview again.</p>
      ) : null}
      {state.kind === "sign_in" ? (
        <p role="alert">Sign in to continue this About request.</p>
      ) : null}
      {state.kind === "blocked" ? (
        <p role="alert">This About request does not match your current business account.</p>
      ) : null}
      {state.kind === "origin_required" ? (
        <p role="alert">
          Open Presence on the same TradeScout site to save or withdraw this request.
        </p>
      ) : null}
      {state.kind === "impersonating" ? (
        <p role="alert">End impersonation before requesting an About change.</p>
      ) : null}
      {preview ? (
        <div className="space-y-3">
          {state.kind === "ready" && state.notice ? <p role="status">{state.notice}</p> : null}
          {!preview.eligible ? (
            <p role="alert">{REASONS[preview.reason as RefusalReason]}</p>
          ) : preview.fact && preview.target ? (
            <>
              <p className="text-sm text-white/75">
                Request for the TradeScout profile of <strong>{profile.displayName}</strong> (/
                {profile.slug}).
              </p>
              <p className="text-xs text-white/65">
                Imported About detail approved {formatDate(preview.fact.approvedAt)}.{" "}
                <a href="#presence-about-fact-review" className="underline">
                  Review the approved detail and its sources
                </a>
                .
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  data-testid="presence-about-current"
                  className="rounded-md border border-white/15 p-3"
                >
                  <h4 className="text-sm font-semibold">Current saved About</h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {preview.target.currentText || "No current About text"}
                  </p>
                </div>
                <div
                  data-testid="presence-about-proposed"
                  className="rounded-md border border-white/15 p-3"
                >
                  <h4 className="text-sm font-semibold">Proposed About</h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {preview.fact.value}
                  </p>
                </div>
              </div>
              {preview.fact.sourceVerificationLimited ? (
                <p className="text-xs text-amber-200">
                  A source link was shortened for privacy and may not open the exact cited page.
                  Check your own records before saving this request.
                </p>
              ) : null}
              <p className="text-xs text-white/60">
                If saved, this authorization expires after 30 days. A separate verified operation
                would be needed before any public About text changes.
              </p>
              {!activeIntent ? (
                <>
                  <p className="text-sm text-white/75">
                    By saving, I authorize a later, separately verified replacement of the About
                    section on this TradeScout profile with this exact proposed text shown above, if
                    that service becomes available before this request expires. Nothing changes now.
                  </p>
                  {preview.replacementRequired ? (
                    <label className="flex gap-2 text-sm text-white/75">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.target.checked)}
                        data-testid="presence-about-replacement-ack"
                      />
                      <span>
                        I understand this deferred request identifies the current saved About text
                        for replacement. No public change will be made now.
                      </span>
                    </label>
                  ) : null}
                  <Button
                    type="button"
                    disabled={saving || (preview.replacementRequired && !acknowledged)}
                    onClick={() => void saveIntent("authorize")}
                    data-testid="presence-about-authorize"
                  >
                    {saving ? "Saving request…" : "Save deferred About authorization"}
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
          {activeIntent ? (
            <div className="space-y-2 text-sm" data-testid="presence-about-active-intent">
              <p>
                Deferred About authorization saved. Expires {formatDate(activeIntent.expiresAt)}.
                TradeScout profile content is unchanged; no public change was made.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void saveIntent("withdraw")}
              >
                Withdraw About request
              </Button>
            </div>
          ) : preview.intent?.status === "expired" || preview.intent?.status === "stale" ? (
            <p className="text-sm text-white/65">
              The previous About request is no longer active. Preview the current details before
              saving another request.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
