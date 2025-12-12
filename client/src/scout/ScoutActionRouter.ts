import type { ScoutAction } from "./state";

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

      case "NOOP":
      default:
        // ignore unknown or noop
        break;
    }
  }
}
