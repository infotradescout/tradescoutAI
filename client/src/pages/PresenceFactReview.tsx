import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { readAuthSessionUser } from "@/lib/authSessionRead";
import { Button } from "@/components/ui/button";
import {
  resolvePresenceFactReview,
  safeFactSourceHref,
  type PresenceFact,
  type PresenceFactReview as FactReview,
} from "@/lib/presenceFacts";
import type { OwnedPresenceProfile, PresenceReviewRecord } from "@/lib/presenceReview";
import PresenceAboutIntent from "./PresenceAboutIntent";

type State =
  | { kind: "loading" | "error" | "stale" | "blocked" | "sign_in" | "impersonating" }
  | { kind: "ready"; review: FactReview; notice?: string };

function isImpersonating(user: Record<string, unknown>): boolean {
  return user.isImpersonating === true || user.impersonating === true;
}

function factLabel(fact: PresenceFact): string {
  return fact.kind === "description"
    ? "Business description"
    : fact.kind === "about"
      ? "About your business"
      : "Service";
}

function decisionLabel(decision: PresenceFact["decision"]): string {
  return decision === "approve"
    ? "Approved for later use"
    : decision === "reject"
      ? "Marked inaccurate"
      : "Waiting for your review";
}

export default function PresenceFactReview({
  record,
  profile,
  ownerUserId,
}: {
  record: PresenceReviewRecord;
  profile: OwnedPresenceProfile;
  ownerUserId: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const runId = useRef(0);
  const inFlight = useRef(false);
  const idempotencyKeys = useRef(new Map<string, string>());
  const ownerRef = useRef(ownerUserId);
  ownerRef.current = ownerUserId;

  const load = useCallback(
    async (expected?: {
      factKey: string;
      valueDigest: string;
      decision: PresenceFact["decision"];
    }) => {
      const run = ++runId.current;
      const current = () => run === runId.current && ownerRef.current === ownerUserId;
      setState({ kind: "loading" });
      try {
        const freshUser = await readAuthSessionUser(buildApiUrl("/api/auth/user"));
        if (!current()) return false;
        if (!freshUser) {
          setState({ kind: "sign_in" });
          return false;
        }
        if (isImpersonating(freshUser)) {
          setState({ kind: "impersonating" });
          return false;
        }
        if (freshUser.id !== ownerUserId || profile.ownerUserId !== ownerUserId) {
          setState({ kind: "blocked" });
          return false;
        }
        const response = await apiRequest("GET", "/api/presence/facts");
        if (!current()) return false;
        const review = resolvePresenceFactReview(response?.review, record, profile, ownerUserId);
        if (!review) {
          setState({ kind: "blocked" });
          return false;
        }
        if (
          expected &&
          !review.facts.some(
            (fact) =>
              fact.factKey === expected.factKey &&
              fact.valueDigest === expected.valueDigest &&
              fact.decision === expected.decision
          )
        ) {
          setState({ kind: "stale" });
          return false;
        }
        setState({
          kind: "ready",
          review,
          ...(expected
            ? { notice: "Your review was recorded. No public information was changed." }
            : {}),
        });
        return true;
      } catch (error) {
        if (!current()) return false;
        if (error instanceof ApiError && error.status === 401) setState({ kind: "sign_in" });
        else if (error instanceof ApiError && error.status === 403) setState({ kind: "blocked" });
        else if (
          error instanceof ApiError &&
          error.code === "PRESENCE_IMPERSONATION_FACT_REVIEW_UNAVAILABLE"
        )
          setState({ kind: "impersonating" });
        else if (error instanceof ApiError && error.status === 409) setState({ kind: "stale" });
        else setState({ kind: "error" });
        return false;
      }
    },
    [ownerUserId, profile, record]
  );

  useEffect(() => {
    void load();
    return () => {
      runId.current += 1;
      inFlight.current = false;
    };
  }, [load]);

  const decide = async (fact: PresenceFact, decision: "approve" | "reject" | "withdraw") => {
    if (state.kind !== "ready" || inFlight.current || profile.ownerUserId !== ownerUserId) return;
    const review = state.review;
    if (
      !review.facts.some(
        (shown) => shown.factKey === fact.factKey && shown.valueDigest === fact.valueDigest
      )
    )
      return;
    const run = runId.current;
    const current = () => run === runId.current && ownerRef.current === ownerUserId;
    inFlight.current = true;
    setSavingKey(fact.factKey);
    try {
      const freshUser = await readAuthSessionUser(buildApiUrl("/api/auth/user"));
      if (!current()) return;
      if (!freshUser) return setState({ kind: "sign_in" });
      if (isImpersonating(freshUser)) return setState({ kind: "impersonating" });
      if (freshUser.id !== ownerUserId) return setState({ kind: "blocked" });
      const attempt = `${review.planId}:${review.revision}:${fact.factKey}:${fact.valueDigest}:${decision}`;
      let idempotencyKey = idempotencyKeys.current.get(attempt);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        idempotencyKeys.current.set(attempt, idempotencyKey);
      }
      const response = await apiRequest(
        "POST",
        `/api/presence/facts/${encodeURIComponent(fact.factKey)}/decision`,
        {
          expectedPlanId: review.planId,
          expectedProfileId: review.profileId,
          expectedRevision: review.revision,
          expectedDigest: review.evidenceDigest,
          expectedPlanHash: review.planHash,
          valueDigest: fact.valueDigest,
          decision,
          idempotencyKey,
        }
      );
      if (!current()) return;
      if (
        response?.decision?.factKey !== fact.factKey ||
        response?.decision?.valueDigest !== fact.valueDigest
      ) {
        return setState({ kind: "error" });
      }
      // The confirmed reload advances runId; release the old save before it.
      inFlight.current = false;
      setSavingKey(null);
      const confirmed = await load({
        factKey: fact.factKey,
        valueDigest: fact.valueDigest,
        decision: decision === "withdraw" ? null : decision,
      });
      if (confirmed) idempotencyKeys.current.delete(attempt);
    } catch (error) {
      if (!current()) return;
      if (error instanceof ApiError && error.status === 401) setState({ kind: "sign_in" });
      else if (error instanceof ApiError && error.status === 403) setState({ kind: "blocked" });
      else if (
        error instanceof ApiError &&
        error.code === "PRESENCE_IMPERSONATION_FACT_REVIEW_UNAVAILABLE"
      )
        setState({ kind: "impersonating" });
      else if (error instanceof ApiError && error.code === "PRESENCE_PLAN_STALE")
        setState({ kind: "stale" });
      else setState({ kind: "error" });
    } finally {
      if (current()) {
        inFlight.current = false;
        setSavingKey(null);
      }
    }
  };

  const approvedAbout =
    state.kind === "ready"
      ? (state.review.facts.find(
          (fact) => fact.factKey === "about" && fact.decision === "approve"
        ) ??
        state.review.facts.find(
          (fact) => fact.factKey === "description" && fact.decision === "approve"
        ))
      : null;

  return (
    <section
      className="space-y-4 rounded-xl border border-white/10 bg-tsCard p-5 text-white"
      data-testid="presence-fact-review"
    >
      <h2 className="text-lg font-semibold">Review imported business details</h2>
      <p className="text-sm text-white/65">
        Check each detail against its sources. Your answers record what may be used later; they do
        not change your public profile, website, or outside accounts.
      </p>
      {state.kind === "loading" ? <p role="status">Loading business details…</p> : null}
      {state.kind === "sign_in" ? <p role="alert">Sign in to review these details.</p> : null}
      {state.kind === "impersonating" ? (
        <p role="alert">End impersonation before reviewing business details.</p>
      ) : null}
      {state.kind === "blocked" ? (
        <p role="alert">This review does not match your current business account.</p>
      ) : null}
      {state.kind === "stale" ? (
        <p role="alert">
          Business details changed. Reload the Presence page before reviewing them.
        </p>
      ) : null}
      {state.kind === "error" ? (
        <div role="alert" className="space-y-2">
          <p>Your answer could not be confirmed. Check the current review before trying again.</p>
          <Button type="button" onClick={() => void load()}>
            Reload review
          </Button>
        </div>
      ) : null}
      {state.kind === "ready" ? (
        <div className="space-y-4">
          {state.notice ? (
            <p role="status" className="text-emerald-300">
              {state.notice}
            </p>
          ) : null}
          {state.review.facts.length === 0 ? (
            <p>No sourced imported details currently need your review.</p>
          ) : null}
          {state.review.facts.map((fact) => (
            <article
              key={fact.factKey}
              id={
                fact.factKey === approvedAbout?.factKey ? "presence-about-fact-review" : undefined
              }
              className="space-y-3 rounded-lg border border-white/15 p-4"
              data-testid={`presence-fact-${fact.factKey}`}
            >
              <h3 className="font-semibold">{factLabel(fact)}</h3>
              <p className="whitespace-pre-wrap break-words text-sm">{fact.value}</p>
              <p className="text-xs text-white/65">{decisionLabel(fact.decision)}</p>
              {fact.sourceVerificationLimited ? (
                <p className="text-xs text-amber-200">
                  This source link was shortened for privacy and may not open the exact page. Check
                  your own records before answering.
                </p>
              ) : null}
              <ul className="space-y-1 text-xs text-white/60">
                {fact.sourceRefs.map((source, index) => {
                  const href = safeFactSourceHref(source);
                  return href ? (
                    <li key={`${fact.factKey}-${index}`}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all underline"
                      >
                        {href}
                      </a>
                    </li>
                  ) : null;
                })}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={savingKey !== null || fact.decision === "approve"}
                  onClick={() => void decide(fact, "approve")}
                >
                  This is accurate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingKey !== null || fact.decision === "reject"}
                  onClick={() => void decide(fact, "reject")}
                >
                  This is inaccurate
                </Button>
                {fact.decision !== null ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={savingKey !== null}
                    onClick={() => void decide(fact, "withdraw")}
                  >
                    Undo answer
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
          {approvedAbout ? (
            <PresenceAboutIntent
              key={`${state.review.planId}:${state.review.revision}:${approvedAbout.factKey}:${approvedAbout.valueDigest}`}
              review={state.review}
              profile={profile}
              fact={approvedAbout}
              ownerUserId={ownerUserId}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
