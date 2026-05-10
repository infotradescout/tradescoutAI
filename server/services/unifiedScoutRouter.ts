import type { ScoutAction, ScoutActionType } from "../../client/src/scout/state";
import {
  ScoutSituationAnalyzer,
  type SituationAnalysisInput,
  type SituationAnalysisResult,
} from "./scoutSituationAnalyzer";
import {
  ScoutTrustIntegration,
  type ScoutTrustContext,
  type TrustAwareRoutingMetadata,
} from "./scoutTrustIntegration";
import { ScoutToneAwareBuilder, type ToneScenario } from "./scoutToneAwareBuilder";
import { sanitizeScoutUserFacingText } from "../scout/userFacingSanitizer";
import {
  UNSUPPORTED_SCOUT_TOOL_MESSAGE,
  getScoutToolName,
  isSupportedScoutToolName,
} from "@shared/scoutSupportedTools";

export interface UnifiedScoutUserContext {
  userId?: string;
  isAuthenticated: boolean;
  userRole?: string;
  location?: {
    county?: string;
    state?: string;
    region?: string;
  };
  trustLevel?: "low" | "medium" | "high";
  permissions?: string[];
}

export interface ScoutActionDefinition {
  type: ScoutActionType;
  category: "navigation" | "ui" | "tool" | "payment" | "admin" | "profile" | "noop";
  requiresAuth: boolean;
  isSensitive: boolean;
  allowedRoles: string[];
  policyChecks: string[];
  description: string;
}

export interface RoutingDecision {
  action: ScoutAction;
  confidence: number;
  reasoning: string;
  sourceLayer: "deterministic" | "fallback";
  metadata?: {
    intentMatched?: string;
    alternativeActions?: ScoutAction[];
    riskLevel?: "low" | "medium" | "high";
    confidenceBand?: "low" | "medium" | "high";
    situation?: {
      stateTag: SituationAnalysisResult["stateTag"];
      contextScore: number;
      confidenceAdjustment: number;
      rationale: string;
      deterministicSignature: string;
    };
    trust?: TrustAwareRoutingMetadata;
    tone?: {
      scenario: ToneScenario;
      toneScore: number;
      guardrailFlags: string[];
    };
  };
}

type RoutingSituationMetadata = NonNullable<RoutingDecision["metadata"]>["situation"];

export interface ActionValidationResult {
  valid: boolean;
  reason?: string;
  nextAction?: ScoutAction;
  metadata?: {
    blockedBy?: string;
    requiresAuth?: boolean;
    requiresRole?: string;
  };
}

export interface PlatformFeatureRoute {
  featureId: string;
  name: string;
  primaryAction: ScoutAction;
  alternativeActions: ScoutAction[];
  roleRequirements: string[];
  authRequired: boolean;
  keywords: string[];
}

export interface UnifiedRoutingOptions {
  situation?: Omit<SituationAnalysisInput, "intent" | "userContext">;
  trust?: ScoutTrustContext;
  tone?: {
    scenario?: ToneScenario;
    countyLabel?: string;
    roleLabel?: string;
    includeNextStep?: boolean;
  };
}

const ADMINISH_ROLES = ["admin", "super_admin", "owner", "head_admin"];

export const SCOUT_ACTION_REGISTRY: Record<ScoutActionType, ScoutActionDefinition> = {
  NAVIGATE: {
    type: "NAVIGATE",
    category: "navigation",
    requiresAuth: false,
    isSensitive: false,
    allowedRoles: [],
    policyChecks: ["url_safety"],
    description: "Navigate to an in-app or external destination",
  },
  OPEN_APP_DRAWER: {
    type: "OPEN_APP_DRAWER",
    category: "ui",
    requiresAuth: false,
    isSensitive: false,
    allowedRoles: [],
    policyChecks: [],
    description: "Open app drawer",
  },
  OPEN_TOOLS_DRAWER: {
    type: "OPEN_TOOLS_DRAWER",
    category: "ui",
    requiresAuth: false,
    isSensitive: false,
    allowedRoles: [],
    policyChecks: [],
    description: "Open tools drawer",
  },
  PREFILL_INPUT: {
    type: "PREFILL_INPUT",
    category: "ui",
    requiresAuth: false,
    isSensitive: false,
    allowedRoles: [],
    policyChecks: [],
    description: "Prefill Scout input",
  },
  ASK_SCOUT: {
    type: "ASK_SCOUT",
    category: "ui",
    requiresAuth: false,
    isSensitive: false,
    allowedRoles: [],
    policyChecks: [],
    description: "Ask Scout follow-up",
  },
  FOLLOW_USER: {
    type: "FOLLOW_USER",
    category: "tool",
    requiresAuth: true,
    isSensitive: true,
    allowedRoles: [],
    policyChecks: ["trust_check"],
    description: "Follow another user",
  },
  UNFOLLOW_USER: {
    type: "UNFOLLOW_USER",
    category: "tool",
    requiresAuth: true,
    isSensitive: true,
    allowedRoles: [],
    policyChecks: [],
    description: "Unfollow another user",
  },
  START_COMMUNITY_VAULT_DONATION: {
    type: "START_COMMUNITY_VAULT_DONATION",
    category: "payment",
    requiresAuth: true,
    isSensitive: true,
    allowedRoles: [],
    policyChecks: ["amount_valid"],
    description: "Create community vault donation checkout",
  },
  START_PLATFORM_SUPPORT: {
    type: "START_PLATFORM_SUPPORT",
    category: "payment",
    requiresAuth: true,
    isSensitive: true,
    allowedRoles: [],
    policyChecks: ["amount_valid"],
    description: "Create platform support checkout",
  },
  SEND_ADMIN_BROADCAST: {
    type: "SEND_ADMIN_BROADCAST",
    category: "admin",
    requiresAuth: true,
    isSensitive: true,
    allowedRoles: ADMINISH_ROLES,
    policyChecks: ["admin_only"],
    description: "Send platform-wide broadcast",
  },
  SAVE_PROFILE: {
    type: "SAVE_PROFILE",
    category: "profile",
    requiresAuth: true,
    isSensitive: true,
    allowedRoles: [],
    policyChecks: ["self_only", "allowed_profile_fields"],
    description: "Save a user-approved profile update for the current account",
  },
  OPEN_FLOATING_NOTE: {
    type: "OPEN_FLOATING_NOTE",
    category: "ui",
    requiresAuth: false,
    isSensitive: false,
    allowedRoles: [],
    policyChecks: [],
    description: "Open floating note surface",
  },
  EXTERNAL_LINK: {
    type: "EXTERNAL_LINK",
    category: "navigation",
    requiresAuth: false,
    isSensitive: false,
    allowedRoles: [],
    policyChecks: ["url_safety"],
    description: "Open external URL",
  },
  CALL_TOOL: {
    type: "CALL_TOOL",
    category: "tool",
    requiresAuth: false,
    isSensitive: false,
    allowedRoles: [],
    policyChecks: [],
    description: "Call Scout tool",
  },
  NOOP: {
    type: "NOOP",
    category: "noop",
    requiresAuth: false,
    isSensitive: false,
    allowedRoles: [],
    policyChecks: [],
    description: "No-op",
  },
};

export const FEATURE_ROUTING_MAP: Record<string, PlatformFeatureRoute> = {
  direct_connect: {
    featureId: "direct_connect",
    name: "Direct Connect",
    primaryAction: { type: "NAVIGATE", to: "/direct-connect", label: "Direct Connect" },
    alternativeActions: [
      { type: "NAVIGATE", to: "/direct-connect/pros", label: "Browse local pros" },
    ],
    roleRequirements: [],
    authRequired: false,
    keywords: [
      "direct connect",
      "direct",
      "connect",
      "contractor",
      "contractors",
      "pro",
      "provider",
      "request",
      "quote",
      "estimate",
      "repair",
      "fix",
      "project help",
      "roof",
      "roofing",
      "plumber",
      "plumbing",
      "hvac",
      "electrical",
      "electrician",
      "foundation",
      "concrete",
      "framing",
      "drywall",
      "painting",
      "landscaping",
    ],
  },
  jobs_workspace: {
    featureId: "jobs_workspace",
    name: "Jobs Workspace",
    primaryAction: { type: "NAVIGATE", to: "/finances/jobs", label: "Open jobs workspace" },
    alternativeActions: [
      { type: "NAVIGATE", to: "/direct-connect", label: "Open Direct Connect" },
      { type: "NAVIGATE", to: "/messages", label: "Open Messages" },
    ],
    roleRequirements: [],
    authRequired: false,
    keywords: [
      "jobs workspace",
      "job workspace",
      "job room",
      "deal room",
      "project tracker",
      "open jobs",
      "open my jobs",
      "open deal room",
      "open project tracker",
    ],
  },
  community: {
    featureId: "community",
    name: "Community",
    primaryAction: { type: "NAVIGATE", to: "/community", label: "Community" },
    alternativeActions: [
      { type: "NAVIGATE", to: "/community-feed", label: "Community feed" },
      { type: "NAVIGATE", to: "/hoa-management", label: "HOA and groups" },
    ],
    roleRequirements: [],
    authRequired: false,
    keywords: ["community", "neighbor", "hoa", "groups", "local activity", "announcements"],
  },
  exchange: {
    featureId: "exchange",
    name: "Exchange",
    primaryAction: { type: "NAVIGATE", to: "/exchange", label: "Exchange" },
    alternativeActions: [
      { type: "NAVIGATE", to: "/trade-deals", label: "Trade deals" },
      { type: "NAVIGATE", to: "/marketplace", label: "Marketplace" },
    ],
    roleRequirements: [],
    authRequired: false,
    keywords: ["exchange", "marketplace", "buy", "sell", "trade", "deals"],
  },
  supply_run: {
    featureId: "supply_run",
    name: "Supply Run",
    primaryAction: {
      type: "NAVIGATE",
      to: "/utilities/supply-run",
      label: "Open Supply Run",
    },
    alternativeActions: [
      { type: "NAVIGATE", to: "/utilities/supply-run/new", label: "Start Supply Run" },
      { type: "NAVIGATE", to: "/direct-connect", label: "Open saved requests" },
    ],
    roleRequirements: [],
    authRequired: false,
    keywords: [
      "supply run",
      "supplies",
      "materials",
      "material order",
      "supplier",
      "lowes",
      "home depot",
      "lumber",
      "pickup",
      "delivery",
    ],
  },
  homescout: {
    featureId: "homescout",
    name: "HomeScout",
    primaryAction: { type: "NAVIGATE", to: "/homescout-listings", label: "HomeScout Listings" },
    alternativeActions: [{ type: "NAVIGATE", to: "/homescout-county", label: "County view" }],
    roleRequirements: [],
    authRequired: false,
    keywords: ["homescout", "home", "listing", "property", "real estate"],
  },
  maps: {
    featureId: "maps",
    name: "Maps",
    primaryAction: { type: "NAVIGATE", to: "/maps", label: "Maps" },
    alternativeActions: [],
    roleRequirements: [],
    authRequired: false,
    keywords: ["map", "maps", "location", "near me", "county map"],
  },
  notes: {
    featureId: "notes",
    name: "Notes",
    primaryAction: { type: "OPEN_FLOATING_NOTE", label: "Open note" },
    alternativeActions: [],
    roleRequirements: [],
    authRequired: false,
    keywords: ["note", "notes", "jot", "quick note"],
  },
};

function normalizeRole(role?: string): string {
  if (!role) return "";
  return role.trim().toLowerCase();
}

export class UnifiedScoutRouter {
  static validateAction(
    action: ScoutAction,
    userContext: UnifiedScoutUserContext
  ): ActionValidationResult {
    const definition = SCOUT_ACTION_REGISTRY[action.type];
    if (!definition) {
      return { valid: false, reason: `Unknown action type: ${String(action.type)}` };
    }

    if (definition.requiresAuth && !userContext.isAuthenticated) {
      return {
        valid: false,
        reason: "This action requires authentication",
        metadata: { requiresAuth: true },
      };
    }

    const role = normalizeRole(userContext.userRole);
    if (definition.allowedRoles.length > 0 && !definition.allowedRoles.includes(role)) {
      return {
        valid: false,
        reason: `This action requires one of: ${definition.allowedRoles.join(", ")}`,
        metadata: { requiresRole: definition.allowedRoles[0] },
      };
    }

    if (action.type === "NAVIGATE" || action.type === "EXTERNAL_LINK") {
      const destination = action.to ?? action.path;
      if (typeof destination === "string" && destination.trim().length > 0) {
        if (!this.isUrlSafe(destination.trim())) {
          return { valid: false, reason: "This URL is not allowed" };
        }
      }
    }

    if (action.type === "CALL_TOOL") {
      const toolName = getScoutToolName(action);
      if (!toolName || !isSupportedScoutToolName(toolName)) {
        return {
          valid: false,
          reason: UNSUPPORTED_SCOUT_TOOL_MESSAGE,
          metadata: { blockedBy: "supported_scout_tools" },
        };
      }
    }

    return { valid: true };
  }

  static resolveIntent(
    intent: string,
    userContext: UnifiedScoutUserContext,
    options?: UnifiedRoutingOptions
  ): RoutingDecision | null {
    const normalized = intent.toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized) return null;

    const routes = Object.values(FEATURE_ROUTING_MAP);
    const supplyRunRoute = FEATURE_ROUTING_MAP.supply_run;
    const hasSupplyRunIntent = supplyRunRoute.keywords.some((keyword) =>
      normalized.includes(keyword)
    );
    const orderedRoutes = hasSupplyRunIntent
      ? [supplyRunRoute, ...routes.filter((route) => route.featureId !== "supply_run")]
      : routes;

    for (const route of orderedRoutes) {
      const matchedKeyword = route.keywords.find((keyword) => normalized.includes(keyword));
      if (!matchedKeyword) continue;
      if (!ScoutTrustIntegration.canAccessFeature(route.featureId, options?.trust)) continue;

      const validation = this.validateAction(route.primaryAction, userContext);
      if (!validation.valid) continue;

      let confidence = 0.9;
      let reasoning = `Matched ${route.name} via "${matchedKeyword}"`;
      let riskLevel: "low" | "medium" | "high" = "low";
      let situationMeta: RoutingSituationMetadata = undefined;
      let confidenceBand: "low" | "medium" | "high" = "high";

      if (options?.situation) {
        const situation = ScoutSituationAnalyzer.analyze({
          intent: normalized,
          userContext,
          activeObjectives: options.situation.activeObjectives,
          recentEvents: options.situation.recentEvents,
          urgencySignals: options.situation.urgencySignals,
          now: options.situation.now,
        });

        confidence = ScoutSituationAnalyzer.applyAdjustment(confidence, situation);
        confidenceBand = situation.confidenceBand;
        reasoning = `${reasoning}. ${situation.rationale}`;
        situationMeta = {
          stateTag: situation.stateTag,
          contextScore: situation.contextScore,
          confidenceAdjustment: situation.confidenceAdjustment,
          rationale: situation.rationale,
          deterministicSignature: situation.deterministicSignature,
        };
        if (situation.stateTag === "blocked") {
          riskLevel = "high";
        } else if (situation.stateTag === "reengaging" || situation.confidenceBand === "medium") {
          riskLevel = "medium";
        }
      }

      let decision: RoutingDecision = {
        action: route.primaryAction,
        confidence,
        reasoning,
        sourceLayer: "deterministic",
        metadata: {
          intentMatched: matchedKeyword,
          alternativeActions: route.alternativeActions,
          riskLevel,
          confidenceBand,
          situation: situationMeta,
        },
      };

      if (options?.trust) {
        decision = ScoutTrustIntegration.attachTrustMetadata(decision, options.trust);
        if (decision.metadata?.trust?.trustSignals.requiredReview) {
          decision.metadata.riskLevel = "high";
        } else if (
          decision.metadata?.riskLevel === "low" &&
          decision.metadata?.trust?.trustSignals.confidenceLevel === "medium"
        ) {
          decision.metadata.riskLevel = "medium";
        }
      }

      if (options?.tone) {
        const toneScenario: ToneScenario =
          options.tone.scenario ??
          (decision.metadata?.riskLevel === "high" ? "blocked_action" : "next_step_prompt");
        const toneResult = ScoutToneAwareBuilder.build({
          scenario: toneScenario,
          message: decision.reasoning,
          countyLabel: options.tone.countyLabel ?? userContext.location?.county,
          roleLabel: options.tone.roleLabel ?? userContext.userRole,
          confidenceBand: decision.metadata?.confidenceBand ?? "medium",
          includeNextStep: options.tone.includeNextStep ?? true,
          nextStepLabel: decision.action.label ?? route.name,
          nextStepRoute: decision.action.to ?? decision.action.path,
        });
        decision.reasoning = toneResult.message;
        decision.metadata = {
          ...(decision.metadata || {}),
          tone: {
            scenario: toneResult.scenario,
            toneScore: toneResult.toneScore,
            guardrailFlags: toneResult.guardrailFlags,
          },
        };
      }

      const scrubbedReasoning = sanitizeScoutUserFacingText(decision.reasoning, {
        fallback: "Matched your request to the clearest next step.",
        maxChars: 360,
      });
      decision.reasoning = scrubbedReasoning.text;

      return decision;
    }

    return null;
  }

  static getFeatureRoute(
    featureId: string,
    userContext: UnifiedScoutUserContext
  ): PlatformFeatureRoute | null {
    const route = FEATURE_ROUTING_MAP[featureId];
    if (!route) return null;

    const role = normalizeRole(userContext.userRole);
    if (route.roleRequirements.length > 0 && !route.roleRequirements.includes(role)) {
      return null;
    }
    if (route.authRequired && !userContext.isAuthenticated) {
      return null;
    }

    return route;
  }

  static discoverFeatures(
    query: string,
    userContext: UnifiedScoutUserContext,
    options?: UnifiedRoutingOptions
  ): PlatformFeatureRoute[] {
    const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized) return [];

    const role = normalizeRole(userContext.userRole);
    const out: PlatformFeatureRoute[] = [];

    for (const route of Object.values(FEATURE_ROUTING_MAP)) {
      if (route.roleRequirements.length > 0 && !route.roleRequirements.includes(role)) continue;
      if (route.authRequired && !userContext.isAuthenticated) continue;

      const keywordMatch = route.keywords.some((keyword) => normalized.includes(keyword));
      const nameMatch = route.name.toLowerCase().includes(normalized);
      if (keywordMatch || nameMatch) out.push(route);
    }

    const trustFiltered = options?.trust
      ? ScoutTrustIntegration.filterFeaturesByTrustGeneric(out, options.trust)
      : out;

    return trustFiltered.sort((a, b) => a.name.localeCompare(b.name));
  }

  static generateFallbackActions(
    _originalIntent: string,
    _failureReason: string,
    userContext: UnifiedScoutUserContext
  ): ScoutAction[] {
    const candidates: ScoutAction[] = [
      { type: "NAVIGATE", to: "/direct-connect", label: "Open Direct Connect" },
      { type: "NAVIGATE", to: "/community", label: "Open Community" },
      { type: "NAVIGATE", to: "/exchange", label: "Open Exchange" },
    ];

    return candidates.filter((action) => this.validateAction(action, userContext).valid);
  }

  static getAllFeatures(): PlatformFeatureRoute[] {
    return Object.values(FEATURE_ROUTING_MAP);
  }

  static getPlatformStats() {
    return {
      totalFeatures: Object.keys(FEATURE_ROUTING_MAP).length,
      totalActions: Object.keys(SCOUT_ACTION_REGISTRY).length,
      featureIds: Object.keys(FEATURE_ROUTING_MAP),
      actionTypes: Object.keys(SCOUT_ACTION_REGISTRY),
    };
  }

  private static isUrlSafe(url: string): boolean {
    if (url.startsWith("/")) return true;
    if (/^(mailto|tel|sms):/i.test(url)) return true;
    if (/^https:\/\//i.test(url)) return true;
    return false;
  }
}
