import type { ScoutAction, ScoutActionType } from "./state";

export type ScoutCommandRiskLevel = "low" | "medium" | "high";

export type ScoutCommandDefinition = {
  commandId: string;
  surface: "scout";
  requiredAuth: boolean;
  requiredRole: string | null;
  requiredTrustLevel: "none" | "basic" | "elevated";
  requiredFields: string[];
  riskLevel: ScoutCommandRiskLevel;
  allowedActions: ScoutActionType[];
  confirmationRequired: boolean;
  successEvent: string;
  failureEvent: string;
};

export type ScoutCommandExecutionContext = {
  isAuthenticated: boolean;
  userRole?: string | null;
};

const ADMINISH_ROLES = new Set(["admin", "super_admin", "owner", "head_admin"]);

export const SCOUT_COMMAND_REGISTRY: Record<ScoutActionType, ScoutCommandDefinition> = {
  NAVIGATE: {
    commandId: "scout.navigate",
    surface: "scout",
    requiredAuth: false,
    requiredRole: null,
    requiredTrustLevel: "none",
    requiredFields: ["to|path"],
    riskLevel: "low",
    allowedActions: ["NAVIGATE"],
    confirmationRequired: false,
    successEvent: "scout_command_navigate_success",
    failureEvent: "scout_command_navigate_failure",
  },
  OPEN_APP_DRAWER: {
    commandId: "scout.open_app_drawer",
    surface: "scout",
    requiredAuth: false,
    requiredRole: null,
    requiredTrustLevel: "none",
    requiredFields: [],
    riskLevel: "low",
    allowedActions: ["OPEN_APP_DRAWER"],
    confirmationRequired: false,
    successEvent: "scout_command_open_app_drawer_success",
    failureEvent: "scout_command_open_app_drawer_failure",
  },
  OPEN_TOOLS_DRAWER: {
    commandId: "scout.open_tools_drawer",
    surface: "scout",
    requiredAuth: false,
    requiredRole: null,
    requiredTrustLevel: "none",
    requiredFields: [],
    riskLevel: "low",
    allowedActions: ["OPEN_TOOLS_DRAWER"],
    confirmationRequired: false,
    successEvent: "scout_command_open_tools_drawer_success",
    failureEvent: "scout_command_open_tools_drawer_failure",
  },
  PREFILL_INPUT: {
    commandId: "scout.prefill_input",
    surface: "scout",
    requiredAuth: false,
    requiredRole: null,
    requiredTrustLevel: "none",
    requiredFields: [],
    riskLevel: "low",
    allowedActions: ["PREFILL_INPUT"],
    confirmationRequired: false,
    successEvent: "scout_command_prefill_success",
    failureEvent: "scout_command_prefill_failure",
  },
  ASK_SCOUT: {
    commandId: "scout.ask_scout",
    surface: "scout",
    requiredAuth: false,
    requiredRole: null,
    requiredTrustLevel: "none",
    requiredFields: ["prompt|payload.prompt"],
    riskLevel: "low",
    allowedActions: ["ASK_SCOUT"],
    confirmationRequired: false,
    successEvent: "scout_command_ask_scout_success",
    failureEvent: "scout_command_ask_scout_failure",
  },
  OPEN_FLOATING_NOTE: {
    commandId: "scout.open_floating_note",
    surface: "scout",
    requiredAuth: false,
    requiredRole: null,
    requiredTrustLevel: "none",
    requiredFields: ["payload.noteId"],
    riskLevel: "low",
    allowedActions: ["OPEN_FLOATING_NOTE"],
    confirmationRequired: false,
    successEvent: "scout_command_open_note_success",
    failureEvent: "scout_command_open_note_failure",
  },
  EXTERNAL_LINK: {
    commandId: "scout.external_link",
    surface: "scout",
    requiredAuth: false,
    requiredRole: null,
    requiredTrustLevel: "none",
    requiredFields: ["to|path"],
    riskLevel: "medium",
    allowedActions: ["EXTERNAL_LINK"],
    confirmationRequired: true,
    successEvent: "scout_command_external_link_success",
    failureEvent: "scout_command_external_link_failure",
  },
  FOLLOW_USER: {
    commandId: "scout.follow_user",
    surface: "scout",
    requiredAuth: true,
    requiredRole: null,
    requiredTrustLevel: "basic",
    requiredFields: ["payload.userId"],
    riskLevel: "medium",
    allowedActions: ["FOLLOW_USER"],
    confirmationRequired: true,
    successEvent: "scout_command_follow_user_success",
    failureEvent: "scout_command_follow_user_failure",
  },
  UNFOLLOW_USER: {
    commandId: "scout.unfollow_user",
    surface: "scout",
    requiredAuth: true,
    requiredRole: null,
    requiredTrustLevel: "basic",
    requiredFields: ["payload.userId"],
    riskLevel: "medium",
    allowedActions: ["UNFOLLOW_USER"],
    confirmationRequired: true,
    successEvent: "scout_command_unfollow_user_success",
    failureEvent: "scout_command_unfollow_user_failure",
  },
  START_COMMUNITY_VAULT_DONATION: {
    commandId: "scout.start_community_vault_donation",
    surface: "scout",
    requiredAuth: true,
    requiredRole: null,
    requiredTrustLevel: "basic",
    requiredFields: ["payload.profileId", "payload.amount"],
    riskLevel: "high",
    allowedActions: ["START_COMMUNITY_VAULT_DONATION"],
    confirmationRequired: true,
    successEvent: "scout_command_donation_checkout_success",
    failureEvent: "scout_command_donation_checkout_failure",
  },
  START_PLATFORM_SUPPORT: {
    commandId: "scout.start_platform_support",
    surface: "scout",
    requiredAuth: true,
    requiredRole: null,
    requiredTrustLevel: "basic",
    requiredFields: ["payload.amount"],
    riskLevel: "high",
    allowedActions: ["START_PLATFORM_SUPPORT"],
    confirmationRequired: true,
    successEvent: "scout_command_platform_support_success",
    failureEvent: "scout_command_platform_support_failure",
  },
  SEND_ADMIN_BROADCAST: {
    commandId: "scout.send_admin_broadcast",
    surface: "scout",
    requiredAuth: true,
    requiredRole: "admin",
    requiredTrustLevel: "elevated",
    requiredFields: ["payload.title", "payload.message"],
    riskLevel: "high",
    allowedActions: ["SEND_ADMIN_BROADCAST"],
    confirmationRequired: true,
    successEvent: "scout_command_admin_broadcast_success",
    failureEvent: "scout_command_admin_broadcast_failure",
  },
  SAVE_PROFILE: {
    commandId: "scout.save_profile",
    surface: "scout",
    requiredAuth: true,
    requiredRole: null,
    requiredTrustLevel: "basic",
    requiredFields: ["payload.profilePatch|payload.preferencesPatch"],
    riskLevel: "high",
    allowedActions: ["SAVE_PROFILE"],
    confirmationRequired: true,
    successEvent: "scout_command_save_profile_success",
    failureEvent: "scout_command_save_profile_failure",
  },
  CALL_TOOL: {
    commandId: "scout.call_tool",
    surface: "scout",
    requiredAuth: false,
    requiredRole: null,
    requiredTrustLevel: "none",
    requiredFields: ["name|payload.name"],
    riskLevel: "high",
    allowedActions: ["CALL_TOOL"],
    confirmationRequired: true,
    successEvent: "scout_command_call_tool_success",
    failureEvent: "scout_command_call_tool_failure",
  },
  NOOP: {
    commandId: "scout.noop",
    surface: "scout",
    requiredAuth: false,
    requiredRole: null,
    requiredTrustLevel: "none",
    requiredFields: [],
    riskLevel: "low",
    allowedActions: ["NOOP"],
    confirmationRequired: false,
    successEvent: "scout_command_noop",
    failureEvent: "scout_command_noop",
  },
};

export function getScoutCommandDefinition(action: ScoutAction): ScoutCommandDefinition | null {
  return SCOUT_COMMAND_REGISTRY[action.type] ?? null;
}

export function canExecuteScoutCommand(
  action: ScoutAction,
  context: ScoutCommandExecutionContext
): { allowed: boolean; reason?: string; definition?: ScoutCommandDefinition } {
  const definition = getScoutCommandDefinition(action);
  if (!definition) return { allowed: false, reason: "unknown_command" };

  if (!definition.allowedActions.includes(action.type)) {
    return { allowed: false, reason: "command_action_mismatch", definition };
  }

  if (definition.requiredAuth && !context.isAuthenticated) {
    return { allowed: false, reason: "auth_required", definition };
  }

  if (definition.requiredRole === "admin") {
    const role = String(context.userRole || "").toLowerCase();
    if (!ADMINISH_ROLES.has(role)) {
      return { allowed: false, reason: "role_required", definition };
    }
  }

  return { allowed: true, definition };
}
