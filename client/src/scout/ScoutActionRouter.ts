import type { ScoutAction } from "./state";
import {
  createCommunityVaultDonationCheckoutSession,
  createPlatformSupportCheckoutSession,
} from "../agent/tools/communityPayments";

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
        const destination = action.to ?? action.path;
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

      case "NOOP":
      default:
        // ignore unknown or noop
        break;
    }
  }
}
