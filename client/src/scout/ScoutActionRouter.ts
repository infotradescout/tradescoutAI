import type { ScoutAction } from "./state";

export interface ScoutActionHelpers {
  navigate: (to: string) => void;
  openAppDrawer: () => void;
  openToolsDrawer: () => void;
  prefillInput: (value: string) => void;
}

export function executeScoutActions(
  actions: ScoutAction[] | undefined,
  helpers: ScoutActionHelpers
) {
  if (!actions || actions.length === 0) return;

  for (const action of actions) {
    switch (action.type) {
      case "NAVIGATE":
        if (action.to) {
          helpers.navigate(action.to);
        }
        break;

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

      case "NOOP":
      default:
        // ignore unknown or noop
        break;
    }
  }
}
