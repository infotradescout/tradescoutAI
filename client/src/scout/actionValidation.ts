/**
 * Action allowlist and enforcement for Scout.
 * Prevents hallucinated or malicious actions from executing.
 */

import type { ScoutAction, ScoutActionType, ScoutMessage, ScoutStatus } from "./state";
import type { ScoutAllowedActionV1 } from "@shared/types/scout";
import { getScoutToolName, isSupportedScoutToolName } from "@shared/scoutSupportedTools";

const ALLOWED_ACTION_TYPES: Set<ScoutActionType> = new Set<ScoutActionType>([
  "NAVIGATE",
  "OPEN_APP_DRAWER",
  "PREFILL_INPUT",
  "OPEN_TOOLS_DRAWER",
  "ASK_SCOUT",
  "OPEN_FLOATING_NOTE",
  "EXTERNAL_LINK",
  "CALL_TOOL",
  "NOOP",
  "FOLLOW_USER",
  "UNFOLLOW_USER",
  "START_COMMUNITY_VAULT_DONATION",
  "START_PLATFORM_SUPPORT",
  "SEND_ADMIN_BROADCAST",
  "SAVE_PROFILE",
]);

// Routes that can be navigated to (allowlist for internal routes)
const ALLOWED_NAVIGATION_PATHS = new Set([
  "/scout",
  "/community",
  "/exchange",
  "/marketplace",
  "/notes",
  "/direct-connect",
  "/direct-connect/pros",
  "/utilities/supply-run",
  "/utilities/supply-run/new",
  "/trade-deals",
  "/projects",
  "/request-quote",
  "/leaderboard",
  "/settings",
  "/profile",
  "/profile-settings",
  "/connections",
  "/conversations",
  "/messages",
  "/notifications",
  "/help",
  "/admin/panel",
  "/hoa-management",
  "/hoa-dashboard",
  "/project-tracker",
  "/lead-management",
  "/finances",
  "/finances/jobs",
  "/finances/materials",
  "/pre-scout-setup",
  "/register",
  "/create-account",
  "/login",
  "/homes",
  "/vehicles",
]);

function isPaymentHandoffAction(action: ScoutAction): boolean {
  const name = getScoutToolName(action).toLowerCase();
  const label = String(action.label || "").toLowerCase();
  const target = String(action.to || action.path || action.payload?.route || "").toLowerCase();
  const text = `${name} ${label} ${target}`;

  return /\b(pay|payment|charge|checkout|refund|donation|donate|support checkout)\b/.test(text);
}

/**
 * Validate and sanitize a Scout action before execution.
 * Returns a safe action or null if invalid.
 */
export function validateAction(action: ScoutAction): ScoutAction | null {
  if (!action || typeof action.type !== "string") {
    console.warn("[Scout] Invalid action: missing type", action);
    return null;
  }

  if (!ALLOWED_ACTION_TYPES.has(action.type)) {
    console.warn("[Scout] Unknown action type blocked:", action.type);
    return { type: "NOOP", label: "Unknown action" };
  }

  // NAVIGATE actions require validation
  if (action.type === "NAVIGATE") {
    const target = action.to ?? action.path;
    if (!target || typeof target !== "string") {
      console.warn("[Scout] NAVIGATE action missing target", action);
      return null;
    }

    // External URLs are allowed (will be opened in new tab)
    if (/^https?:\/\//i.test(target)) {
      return { ...action, to: target, path: target };
    }

    // API auth redirects are allowed
    if (target.startsWith("/api/auth/")) {
      return { ...action, to: target, path: target };
    }

    // Internal routes must match allowlist or dynamic patterns
    const basePath = target.split("?")[0].split("#")[0];
    const isAllowedStatic = ALLOWED_NAVIGATION_PATHS.has(basePath);
    const isAllowedDynamic =
      /^\/contractors\/[a-zA-Z0-9_-]+$/.test(basePath) ||
      /^\/exchange\/[a-zA-Z0-9_-]+$/.test(basePath) ||
      /^\/profile\/[a-zA-Z0-9_-]+/.test(basePath) ||
      /^\/community\/[a-zA-Z0-9_-]+$/.test(basePath) ||
      /^\/groups\/[a-zA-Z0-9_-]+$/.test(basePath) ||
      /^\/help\/[a-zA-Z0-9_-]+$/.test(basePath);

    if (!isAllowedStatic && !isAllowedDynamic) {
      console.warn("[Scout] Navigation path not allowlisted:", basePath);
      return null;
    }

    return { ...action, to: target, path: target };
  }

  // PREFILL_INPUT requires text payload
  if (action.type === "PREFILL_INPUT") {
    const hasText =
      typeof action.payload?.text === "string" &&
      Boolean((action.payload.text as string).trim().length > 0);
    const hasStructuredPrefill =
      action.payload &&
      typeof action.payload.prefill === "object" &&
      action.payload.prefill !== null &&
      !Array.isArray(action.payload.prefill);

    if (!hasText && !hasStructuredPrefill) {
      console.warn("[Scout] PREFILL_INPUT missing valid text", action);
      return null;
    }
  }

  // OPEN_FLOATING_NOTE requires noteId payload
  if (action.type === "OPEN_FLOATING_NOTE") {
    if (!action.payload || typeof action.payload.noteId !== "string") {
      console.warn("[Scout] OPEN_FLOATING_NOTE missing noteId", action);
      return null;
    }
  }

  // ASK_SCOUT requires prompt (either top-level or in payload)
  if (action.type === "ASK_SCOUT") {
    const prompt = action.prompt || (action.payload?.prompt as string | undefined);
    if (typeof prompt !== "string" || !prompt.trim()) {
      console.warn("[Scout] ASK_SCOUT missing prompt", action);
      return null;
    }
  }

  // FOLLOW_USER / UNFOLLOW_USER require userId
  if (action.type === "FOLLOW_USER" || action.type === "UNFOLLOW_USER") {
    if (
      !action.payload ||
      typeof action.payload.userId !== "string" ||
      !action.payload.userId.trim()
    ) {
      console.warn(`[Scout] ${action.type} missing userId`, action);
      return null;
    }
  }

  // SEND_ADMIN_BROADCAST requires title and message
  if (action.type === "SEND_ADMIN_BROADCAST") {
    if (
      !action.payload ||
      typeof action.payload.title !== "string" ||
      typeof action.payload.message !== "string" ||
      !action.payload.title.trim() ||
      !action.payload.message.trim()
    ) {
      console.warn("[Scout] SEND_ADMIN_BROADCAST missing title or message", action);
      return null;
    }
  }

  if (action.type === "SAVE_PROFILE") {
    const profilePatch = action.payload?.profilePatch;
    const preferencesPatch = action.payload?.preferencesPatch;
    const hasProfilePatch =
      profilePatch &&
      typeof profilePatch === "object" &&
      !Array.isArray(profilePatch) &&
      Object.keys(profilePatch).length > 0;
    const hasPreferencesPatch =
      preferencesPatch &&
      typeof preferencesPatch === "object" &&
      !Array.isArray(preferencesPatch) &&
      Object.keys(preferencesPatch).length > 0;

    if (!hasProfilePatch && !hasPreferencesPatch) {
      console.warn("[Scout] SAVE_PROFILE missing profile/preferences patch", action);
      return null;
    }
  }

  if (action.type === "CALL_TOOL") {
    const toolName = getScoutToolName(action);
    if ((!toolName || !isSupportedScoutToolName(toolName)) && !isPaymentHandoffAction(action)) {
      console.warn("[Scout] Unsupported tool action blocked:", toolName || "(missing)");
      return null;
    }
  }

  // Action is safe
  return action;
}

/**
 * Validate and sanitize an array of actions.
 * Returns only valid actions.
 */
export function validateActions(actions: ScoutAction[] | undefined): ScoutAction[] {
  if (!Array.isArray(actions)) return [];
  return actions.map(validateAction).filter((a): a is ScoutAction => a !== null);
}

/** Convert one server-owned v1 action through the canonical action validator. */
export function scoutAllowedActionToAction(action: ScoutAllowedActionV1): ScoutAction | null {
  const target = typeof action.target === "string" ? action.target : undefined;
  const payload = {
    ...(action.payload || {}),
    ...(action.requires_confirmation ? { requiresApproval: true } : {}),
  };
  const validated = validateAction({
    type: action.type as ScoutAction["type"],
    label: action.label,
    ...(target ? { to: target, path: target } : {}),
    ...(action.prompt ? { prompt: action.prompt } : {}),
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
    primary: action.primary,
  });

  return validated?.type === "NOOP" ? null : validated;
}

function actionIdentity(action: ScoutAction): string {
  const target =
    action.to ||
    action.path ||
    action.prompt ||
    action.payload?.route ||
    action.payload?.name ||
    JSON.stringify(action.payload || {});
  return [action.type, action.label || "", target]
    .map((value) => String(value).trim().toLowerCase())
    .join("::");
}

function validateLegacyActionCandidates(actions: ScoutAction[]): ScoutAction[] {
  const deduped = new Map<string, ScoutAction>();
  for (const action of validateActions(actions)) {
    if (action.type === "NOOP") continue;
    const key = actionIdentity(action);
    const existing = deduped.get(key);
    if (!existing || (action.primary === true && existing.primary !== true)) {
      deduped.set(key, action);
    }
  }
  return [...deduped.values()];
}

export type LatestScoutTurnActionTruth = {
  actions: ScoutAction[];
  dominantAction: ScoutAction | null;
  source: "v1" | "legacy" | "none";
};

const EMPTY_LATEST_TURN_ACTION_TRUTH: LatestScoutTurnActionTruth = {
  actions: [],
  dominantAction: null,
  source: "none",
};

/**
 * Resolve task-card actions from the newest completed user/assistant turn only.
 * A v1 result is authoritative even when it deliberately supplies no actions.
 */
export function resolveLatestScoutTurnActionTruth({
  messages,
  lastActions,
  status,
}: {
  messages: ScoutMessage[];
  lastActions?: ScoutAction[];
  status: ScoutStatus;
}): LatestScoutTurnActionTruth {
  let newestUserIndex = -1;
  let newestTurnIndex = -1;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const role = messages[index]?.role;
    if (newestTurnIndex < 0 && (role === "user" || role === "assistant")) {
      newestTurnIndex = index;
    }
    if (role === "user") {
      newestUserIndex = index;
      break;
    }
  }

  const newestTurn = newestTurnIndex >= 0 ? messages[newestTurnIndex] : undefined;
  if (
    newestUserIndex < 0 ||
    newestTurnIndex <= newestUserIndex ||
    newestTurn?.role !== "assistant"
  ) {
    return EMPTY_LATEST_TURN_ACTION_TRUTH;
  }

  const isSuppressedStatus =
    status === "resolving_context" ||
    status === "checking_documents" ||
    status === "executing_action" ||
    status === "error";
  const resultContract = newestTurn.resultContract;

  if (resultContract?.contract_version === "scout_result.v1") {
    const allowedActions = Array.isArray(resultContract.allowed_actions)
      ? resultContract.allowed_actions
      : [];
    const actions = allowedActions.flatMap((action) => {
      const validated = scoutAllowedActionToAction(action);
      return validated ? [validated] : [];
    });
    const primaryActions = actions.filter((action) => action.primary === true);
    const hasAmbiguity =
      Array.isArray(resultContract.ambiguity_options) &&
      resultContract.ambiguity_options.length > 0;

    return {
      actions,
      dominantAction:
        !isSuppressedStatus && !hasAmbiguity && primaryActions.length === 1
          ? primaryActions[0]
          : null,
      source: "v1",
    };
  }

  const clusterActions = (newestTurn.clusters || []).flatMap((cluster) => [
    ...(cluster.primaryAction ? [{ ...cluster.primaryAction, primary: true }] : []),
    ...(Array.isArray(cluster.actions) ? cluster.actions : []),
  ]);
  const frameActions = (newestTurn.frame?.actionChips || []).map((chip): ScoutAction => {
    const args =
      chip.args && typeof chip.args === "object"
        ? (chip.args as Record<string, unknown>)
        : undefined;
    if (chip.kind === "NAVIGATE") {
      return {
        type: "NAVIGATE",
        label: chip.label,
        to: chip.target,
        path: chip.target,
        payload: args,
        primary: chip.priority === "primary",
      };
    }
    return {
      type: "CALL_TOOL",
      label: chip.label,
      payload: { ...(args || {}), name: chip.target },
      primary: chip.priority === "primary",
    };
  });
  const embeddedLegacyActions = [...clusterActions, ...frameActions];
  const legacyCandidates =
    embeddedLegacyActions.length > 0
      ? embeddedLegacyActions
      : Array.isArray(lastActions)
        ? lastActions
        : [];
  const actions = validateLegacyActionCandidates(legacyCandidates);
  const primaryActions = actions.filter((action) => action.primary === true);

  return {
    actions,
    dominantAction: !isSuppressedStatus && primaryActions.length === 1 ? primaryActions[0] : null,
    source: actions.length > 0 ? "legacy" : "none",
  };
}

/**
 * Check if a link is safe for rendering.
 * Returns true if the link is internal or a known external domain.
 */
export function isSafeLinkTarget(href: string): boolean {
  if (!href || typeof href !== "string") return false;

  // Internal links are safe
  if (href.startsWith("/")) return true;

  // External links must be HTTPS
  if (/^https:\/\//i.test(href)) return true;

  // HTTP is not safe
  if (/^http:\/\//i.test(href)) return false;

  // Relative or unknown scheme: not safe
  return false;
}
