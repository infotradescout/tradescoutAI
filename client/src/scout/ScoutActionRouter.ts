import type { ScoutAction } from "./state";
import {
  createCommunityVaultDonationCheckoutSession,
  createPlatformSupportCheckoutSession,
} from "../agent/tools/communityPayments";
import { followUser, unfollowUser } from "../agent/tools/connections";
import { sendAdminBroadcast } from "../agent/tools/adminBroadcast";
import { openFloatingNote } from "@/lib/floatingNotes";

export interface ScoutActionHelpers {
  navigate: (to: string) => void;
  openAppDrawer: () => void;
  openToolsDrawer: () => void;
  prefillInput: (value: string) => void;
  askScout?: (prompt: string) => void;
}

type GuardedActionResponse = {
  success?: boolean;
  message?: string;
  nextAction?: ScoutAction;
};

function isSensitiveScoutAction(action: ScoutAction): boolean {
  switch (action.type) {
    case "SEND_ADMIN_BROADCAST":
    case "START_COMMUNITY_VAULT_DONATION":
    case "START_PLATFORM_SUPPORT":
    case "FOLLOW_USER":
    case "UNFOLLOW_USER":
      return true;
    default:
      return false;
  }
}

async function executeActionViaServerGuard(action: ScoutAction): Promise<{
  blocked: boolean;
  message?: string;
  nextAction?: ScoutAction;
}> {
  try {
    const res = await fetch("/api/scout/execute-action", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        guardContext: (action as any)?._guardContext ?? null,
      }),
    });

    if (!res.ok) {
      // Guard endpoint unavailable should never block local execution.
      if (res.status >= 500) {
        return isSensitiveScoutAction(action)
          ? {
              blocked: true,
              message: "This action is temporarily unavailable. Please try again shortly.",
            }
          : { blocked: false };
      }

      const fail = (await res.json().catch(() => ({}))) as GuardedActionResponse;
      return {
        blocked: true,
        message: fail.message || "This action is blocked right now.",
      };
    }

    const ok = (await res.json().catch(() => ({}))) as GuardedActionResponse;
    if (ok.success === false) {
      return {
        blocked: true,
        message: ok.message || "This action is blocked right now.",
      };
    }

    return {
      blocked: false,
      nextAction:
        ok.nextAction && typeof ok.nextAction.type === "string"
          ? (ok.nextAction as ScoutAction)
          : undefined,
    };
  } catch {
    // Network/intermittent failures degrade gracefully for low-risk actions only.
    return isSensitiveScoutAction(action)
      ? {
          blocked: true,
          message: "This action is temporarily unavailable. Please try again shortly.",
        }
      : { blocked: false };
  }
}

function buildStructuredPrefillRoute(action: ScoutAction): string | null {
  const payload = action.payload ?? {};
  const routeCandidate =
    (typeof action.to === "string" && action.to.trim()) ||
    (typeof action.path === "string" && action.path.trim()) ||
    (typeof payload.route === "string" && (payload.route as string).trim()) ||
    "";

  if (!routeCandidate) return null;

  const target = typeof payload.target === "string" ? payload.target : "";
  const prefill =
    payload.prefill && typeof payload.prefill === "object" && !Array.isArray(payload.prefill)
      ? (payload.prefill as Record<string, unknown>)
      : null;

  if (!prefill) return routeCandidate;

  const params = new URLSearchParams();

  if (target === "direct_connect_request") {
    const scope = typeof prefill.scope === "string" ? prefill.scope.trim() : "";
    const jobType = typeof prefill.jobType === "string" ? prefill.jobType.trim() : "";
    const tradeId =
      typeof prefill.tradeId === "string"
        ? prefill.tradeId.trim()
        : typeof prefill.trade === "string"
          ? prefill.trade.trim()
          : "";
    const urgency = typeof prefill.urgency === "string" ? prefill.urgency.trim() : "";
    const budgetMin =
      typeof prefill.budgetMin === "number"
        ? prefill.budgetMin
        : typeof prefill.budgetMin === "string"
          ? Number(prefill.budgetMin)
          : NaN;
    const budgetMax =
      typeof prefill.budgetMax === "number"
        ? prefill.budgetMax
        : typeof prefill.budgetMax === "string"
          ? Number(prefill.budgetMax)
          : NaN;

    if (scope) {
      params.set("title", jobType ? `${jobType} request` : "Service request");
      params.set("description", scope);
    } else if (jobType) {
      params.set("title", `${jobType} request`);
    }
    if (urgency) params.set("urgency", urgency);
    if (tradeId || jobType) params.set("trade", tradeId || jobType);
    if (Number.isFinite(budgetMin) && budgetMin > 0) params.set("budgetMin", String(budgetMin));
    if (Number.isFinite(budgetMax) && budgetMax > 0) params.set("budgetMax", String(budgetMax));
    params.set("source", "scout");

    const base = "/direct-connect";
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }

  if (target === "exchange_listing") {
    const title = typeof prefill.title === "string" ? prefill.title.trim() : "";
    const description = typeof prefill.description === "string" ? prefill.description.trim() : "";
    const location = typeof prefill.location === "string" ? prefill.location.trim() : "";
    const price =
      typeof prefill.price === "number"
        ? prefill.price
        : typeof prefill.price === "string"
          ? Number(prefill.price)
          : NaN;

    params.set("tab", "sell");
    if (title) params.set("title", title);
    if (description) params.set("description", description);
    if (location) params.set("loc", location);
    if (Number.isFinite(price) && price > 0) params.set("price", String(price));

    const query = params.toString();
    return query ? `/exchange?${query}` : "/exchange?tab=sell";
  }

  if (target === "community_post") {
    const title = typeof prefill.title === "string" ? prefill.title.trim() : "";
    const body = typeof prefill.body === "string" ? prefill.body.trim() : "";
    const text = [title, body].filter(Boolean).join("\n\n");
    params.set("compose", "1");
    if (text) params.set("prefill", text);
    const query = params.toString();
    return query ? `/community?${query}` : "/community?compose=1";
  }

  return routeCandidate;
}

async function executeScoutActionLocal(action: ScoutAction, helpers: ScoutActionHelpers) {
  switch (action.type) {
    case "NAVIGATE": {
      let destination = action.to ?? action.path;
      if (destination) {
        const adId =
          typeof action.payload?.adId === "string" ? (action.payload.adId as string) : null;
        if (adId) {
          void fetch("/api/ads/track-click", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adId, source: "scout" }),
          }).catch(() => undefined);
        }

        if (/^https?:\/\//i.test(destination)) {
          try {
            window.open(destination, "_blank", "noopener,noreferrer");
          } catch {
            // ignore
          }
          return;
        }

        if (destination.startsWith("/api/auth/")) {
          window.location.href = destination;
          return;
        }

        // If a jobId payload is present, deep-link into finance jobs flow
        const jobId =
          typeof action.payload?.jobId === "string" ? (action.payload.jobId as string) : null;
        if (
          jobId &&
          (destination === "/lead-management" ||
            destination === "/project-tracker" ||
            destination === "/finances")
        ) {
          destination = `/finances/jobs?jobId=${encodeURIComponent(jobId)}`;
        }
        helpers.navigate(destination);
      }
      return;
    }

    case "OPEN_APP_DRAWER":
      // "Browse TradeScout" drawer is retired; route this action to tools drawer.
      helpers.openToolsDrawer();
      return;

    case "OPEN_TOOLS_DRAWER":
      helpers.openToolsDrawer();
      return;

    case "PREFILL_INPUT":
      if (typeof action.payload?.text === "string") {
        helpers.prefillInput(action.payload.text as string);
      }

      {
        const destination = buildStructuredPrefillRoute(action);
        if (destination) {
          helpers.navigate(destination);
        }
      }
      return;

    case "SAVE_PROFILE":
      return;

    case "ASK_SCOUT":
      if (action.prompt && helpers.askScout) {
        helpers.askScout(action.prompt);
      }
      return;

    case "FOLLOW_USER": {
      const targetId =
        typeof action.payload?.userId === "string" ? (action.payload.userId as string) : null;
      if (!targetId) return;

      try {
        await followUser(targetId);
        // After follow, take the user to their connections view so they see the change.
        helpers.navigate("/connections?tab=social");
      } catch (err) {
        console.error("Failed to follow user from Scout action", err);
      }

      return;
    }

    case "UNFOLLOW_USER": {
      const targetId =
        typeof action.payload?.userId === "string" ? (action.payload.userId as string) : null;
      if (!targetId) return;

      try {
        await unfollowUser(targetId);
        helpers.navigate("/connections?tab=social");
      } catch (err) {
        console.error("Failed to unfollow user from Scout action", err);
      }

      return;
    }

    case "START_COMMUNITY_VAULT_DONATION": {
      const profileId =
        typeof action.payload?.profileId === "string" ? (action.payload.profileId as string) : null;
      const amount =
        typeof action.payload?.amount === "number"
          ? (action.payload.amount as number)
          : typeof action.payload?.amount === "string"
            ? Number(action.payload.amount)
            : NaN;
      const causeId =
        typeof action.payload?.causeId === "string"
          ? (action.payload.causeId as string)
          : undefined;

      if (!profileId || !Number.isFinite(amount) || amount <= 0) return;

      const origin = window.location.origin;
      const { url } = await createCommunityVaultDonationCheckoutSession({
        profileId,
        amount,
        causeId,
        successUrl: `${origin}/profile/${profileId}/community?checkout=success`,
        cancelUrl: `${origin}/profile/${profileId}/community?checkout=cancel`,
      });
      window.location.href = url;

      return;
    }

    case "START_PLATFORM_SUPPORT": {
      const amount =
        typeof action.payload?.amount === "number"
          ? (action.payload.amount as number)
          : typeof action.payload?.amount === "string"
            ? Number(action.payload.amount)
            : NaN;
      const mode =
        action.payload?.mode === "subscription" || action.payload?.mode === "one_time"
          ? (action.payload.mode as "subscription" | "one_time")
          : "one_time";
      const originatingProfileId =
        typeof action.payload?.originatingProfileId === "string"
          ? (action.payload.originatingProfileId as string)
          : undefined;

      if (!Number.isFinite(amount) || amount <= 0) return;

      const origin = window.location.origin;
      const profileSuffix = originatingProfileId
        ? `/profile/${originatingProfileId}/community`
        : "/";
      const { url } = await createPlatformSupportCheckoutSession({
        amount,
        mode,
        originatingProfileId,
        successUrl: `${origin}${profileSuffix}?checkout=success`,
        cancelUrl: `${origin}${profileSuffix}?checkout=cancel`,
      });
      window.location.href = url;

      return;
    }

    case "SEND_ADMIN_BROADCAST": {
      const payload = action.payload ?? {};

      const segmentValue =
        typeof payload.segment === "string" &&
        ["all", "homeowners", "contractors", "pros", "admins"].includes(payload.segment)
          ? (payload.segment as "all" | "homeowners" | "contractors" | "pros" | "admins")
          : "all";

      const title = typeof payload.title === "string" ? payload.title : "";
      const message = typeof payload.message === "string" ? payload.message : "";
      if (!title.trim() || !message.trim()) return;

      const rawMethods = Array.isArray((payload as any).deliveryMethods)
        ? ((payload as any).deliveryMethods as unknown[])
        : [];
      const deliveryMethods = rawMethods
        .map((m) => (typeof m === "string" ? m : ""))
        .filter((m) => m === "in_app" || m === "email" || m === "push" || m === "sms");

      const campaignType =
        typeof (payload as any).campaignType === "string" && (payload as any).campaignType.trim()
          ? ((payload as any).campaignType as string)
          : undefined;

      const rawTags = Array.isArray((payload as any).tags)
        ? ((payload as any).tags as unknown[])
        : [];
      const tags = rawTags
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => t.length > 0);

      const targetFilters: any = {};

      const rawStateCodes = Array.isArray((payload as any).stateCodes)
        ? ((payload as any).stateCodes as unknown[])
        : Array.isArray((payload as any).targetStates)
          ? ((payload as any).targetStates as unknown[])
          : Array.isArray((payload as any).targetFilters?.stateCodes)
            ? ((payload as any).targetFilters.stateCodes as unknown[])
            : [];

      const stateCodes = rawStateCodes
        .map((v) => (typeof v === "string" ? v.trim().toUpperCase() : ""))
        .filter((v) => v.length > 0);
      if (stateCodes.length > 0) {
        targetFilters.stateCodes = stateCodes;
      }

      const onlyWithMarketingEmails =
        (payload as any).onlyWithMarketingEmails === true ||
        (payload as any).targetFilters?.onlyWithMarketingEmails === true;
      if (onlyWithMarketingEmails) {
        targetFilters.onlyWithMarketingEmails = true;
      }

      try {
        await sendAdminBroadcast({
          segment: segmentValue,
          title: title.trim(),
          message: message.trim(),
          deliveryMethods: (deliveryMethods.length > 0 ? deliveryMethods : undefined) as any,
          campaignType,
          tags,
          targetFilters: Object.keys(targetFilters).length > 0 ? targetFilters : undefined,
        });
      } catch (err) {
        console.error("Failed to send admin broadcast from Scout action", err);
      }

      return;
    }

    case "OPEN_FLOATING_NOTE": {
      const noteId =
        typeof action.payload?.noteId === "string" && action.payload.noteId.trim()
          ? (action.payload.noteId as string).trim()
          : "quick";
      await openFloatingNote(noteId);
      return;
    }

    case "EXTERNAL_LINK": {
      const url = action.to ?? action.path;
      if (url && typeof url === "string") {
        // Handle mailto:, tel:, sms: links
        if (/^(mailto|tel|sms):/i.test(url)) {
          window.location.href = url;
        } else if (/^https?:\/\//i.test(url)) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }
      return;
    }

    case "CALL_TOOL": {
      const name = typeof (action as any).name === "string" ? (action as any).name : "";
      const args = (action as any).args ?? action.payload ?? {};

      // Small feature flag so Scout feedback can be toggled without UI changes
      const feedbackEnabled =
        typeof window !== "undefined" &&
        window.localStorage.getItem("scout:ads-feedback-enabled") !== "0";

      if (name === "ads.feedback" && feedbackEnabled) {
        const adId = typeof args.adId === "string" ? (args.adId as string) : undefined;
        const rating =
          args.rating === "helpful" || args.rating === "not_relevant" || args.rating === "spam"
            ? (args.rating as "helpful" | "not_relevant" | "spam")
            : undefined;
        const source =
          args.source === "scout" || args.source === "site_visit" || args.source === "saved"
            ? (args.source as "scout" | "site_visit" | "saved")
            : "scout";

        if (adId && rating) {
          void fetch("/api/ads/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adId, rating, source }),
          }).catch(() => undefined);
        }
      }

      return;
    }

    case "NOOP":
    default:
      return;
  }
}

export async function executeScoutActions(
  actions: ScoutAction[] | undefined,
  helpers: ScoutActionHelpers
) {
  if (!actions || actions.length === 0) return;

  for (const action of actions) {
    if (action.type === "NOOP") {
      continue;
    }

    const guarded = await executeActionViaServerGuard(action);
    if (guarded.blocked) {
      throw new Error(guarded.message || "This action is blocked right now.");
    }

    await executeScoutActionLocal(action, helpers);

    if (guarded.nextAction && guarded.nextAction.type !== "NOOP") {
      await executeScoutActionLocal(guarded.nextAction, helpers);
    }
  }
}
