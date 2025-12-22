import type { ScoutAction } from "./state";
import {
  createCommunityVaultDonationCheckoutSession,
  createPlatformSupportCheckoutSession,
} from "../agent/tools/communityPayments";
import { followUser, unfollowUser } from "../agent/tools/connections";
import { sendAdminBroadcast } from "../agent/tools/adminBroadcast";

export interface ScoutActionHelpers {
  navigate: (to: string) => void;
  openAppDrawer: () => void;
  openToolsDrawer: () => void;
  prefillInput: (value: string) => void;
  askScout?: (prompt: string) => void;
}

export function executeScoutActions(
  actions: ScoutAction[] | undefined,
  helpers: ScoutActionHelpers
) {
  if (!actions || actions.length === 0) return;

  for (const action of actions) {
    switch (action.type) {
      case "NAVIGATE": {
        let destination = action.to ?? action.path;
        if (destination) {
          const adId = typeof action.payload?.adId === "string" ? (action.payload.adId as string) : null;
          if (adId) {
            void fetch("/api/ads/track-click", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ adId }),
            }).catch(() => undefined);
          }

          if (/^https?:\/\//i.test(destination)) {
            try {
              window.open(destination, "_blank", "noopener,noreferrer");
            } catch {
              // ignore
            }
            break;
          }

          if (destination.startsWith("/api/auth/")) {
            window.location.href = destination;
            break;
          }

          // If a jobId payload is present, deep-link into the Deal Room
          const jobId = typeof action.payload?.jobId === "string" ? (action.payload.jobId as string) : null;
          if (
            jobId &&
            (destination === "/lead-management" || destination === "/project-tracker" || destination === "/finances")
          ) {
            destination = `/deal-room/${encodeURIComponent(jobId)}`;
          }
          helpers.navigate(destination);
        }
        break;
      }

      case "OPEN_APP_DRAWER":
        helpers.openAppDrawer();
        break;

      case "OPEN_TOOLS_DRAWER":
        helpers.openToolsDrawer();
        break;

      case "PREFILL_INPUT":
        if (typeof action.payload?.text === "string") {
          helpers.prefillInput(action.payload.text as string);
        }
        break;

      case "ASK_SCOUT":
        if (action.prompt && helpers.askScout) {
          helpers.askScout(action.prompt);
        }
        break;

      case "MEALSCOUT_COMMAND": {
        // For now, treat any MealScout command as a deep-link into the MealScout tab.
        // We can later read a queued command from storage or context inside MealScoutBridge.
        try {
          if (action.payload) {
            window.localStorage.setItem(
              "mealscout:pending-command",
              JSON.stringify(action.payload)
            );
          }
        } catch {
          // ignore storage failures; navigation still works
        }

        helpers.navigate("/mealscout");
        break;
      }

      case "FOLLOW_USER": {
        const targetId =
          typeof action.payload?.userId === "string"
            ? (action.payload.userId as string)
            : null;
        if (!targetId) break;

        void (async () => {
          try {
            await followUser(targetId);
            // After follow, take the user to their connections view so they see the change.
            helpers.navigate("/connections");
          } catch (err) {
            console.error("Failed to follow user from Scout action", err);
          }
        })();

        break;
      }

      case "UNFOLLOW_USER": {
        const targetId =
          typeof action.payload?.userId === "string"
            ? (action.payload.userId as string)
            : null;
        if (!targetId) break;

        void (async () => {
          try {
            await unfollowUser(targetId);
            helpers.navigate("/connections");
          } catch (err) {
            console.error("Failed to unfollow user from Scout action", err);
          }
        })();

        break;
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
        const causeId = typeof action.payload?.causeId === "string" ? (action.payload.causeId as string) : undefined;

        if (!profileId || !Number.isFinite(amount) || amount <= 0) break;

        void (async () => {
          const origin = window.location.origin;
          const { url } = await createCommunityVaultDonationCheckoutSession({
            profileId,
            amount,
            causeId,
            successUrl: `${origin}/profile/${profileId}/community?checkout=success`,
            cancelUrl: `${origin}/profile/${profileId}/community?checkout=cancel`,
          });
          window.location.href = url;
        })();

        break;
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

        if (!Number.isFinite(amount) || amount <= 0) break;

        void (async () => {
          const origin = window.location.origin;
          const profileSuffix = originatingProfileId ? `/profile/${originatingProfileId}/community` : "/";
          const { url } = await createPlatformSupportCheckoutSession({
            amount,
            mode,
            originatingProfileId,
            successUrl: `${origin}${profileSuffix}?checkout=success`,
            cancelUrl: `${origin}${profileSuffix}?checkout=cancel`,
          });
          window.location.href = url;
        })();

        break;
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
        if (!title.trim() || !message.trim()) break;

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

        const rawTags = Array.isArray((payload as any).tags) ? ((payload as any).tags as unknown[]) : [];
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

        void (async () => {
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
        })();

        break;
      }

      case "NOOP":
      default:
        // ignore unknown or noop
        break;
    }
  }
}
