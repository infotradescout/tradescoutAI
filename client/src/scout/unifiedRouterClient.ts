import type { ScoutAction } from "./state";

export interface UnifiedRouterUserContext {
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

export interface UnifiedRoutingDecision {
  action: ScoutAction;
  confidence: number;
  reasoning: string;
  sourceLayer?: "deterministic" | "fallback";
  metadata?: {
    intentMatched?: string;
    alternativeActions?: ScoutAction[];
    riskLevel?: "low" | "medium" | "high";
    confidenceBand?: "low" | "medium" | "high";
    trust?: {
      trustSignals?: {
        cvsScore?: number | null;
        confidenceLevel?: "low" | "medium" | "high";
        confidenceNumeric?: number;
        verifiedActivityProof?: string;
        verificationStatus?: "approved" | "pending" | "rejected" | "suspended" | "unknown";
        riskFlags?: string[];
        trustBandLabel?: string;
        requiredReview?: boolean;
      };
      minRequiredScore?: number;
      trustFilterApplied?: boolean;
    };
    tone?: {
      scenario?:
        | "default"
        | "technical_fallback"
        | "confidence_low"
        | "blocked_action"
        | "next_step_prompt";
      toneScore?: number;
      guardrailFlags?: string[];
    };
  };
}

export interface UnifiedActionValidation {
  valid: boolean;
  reason?: string;
  nextAction?: ScoutAction;
  metadata?: {
    blockedBy?: string;
    requiresAuth?: boolean;
    requiresRole?: string;
  };
}

export interface UnifiedSituationObjective {
  id: string;
  title?: string;
  intentClass?: string;
  status: "active" | "paused" | "completed" | "abandoned";
  progressPct?: number;
  updatedAt?: string;
}

export interface UnifiedSituationEvent {
  type:
    | "route_success"
    | "route_failure"
    | "action_success"
    | "action_failure"
    | "objective_started"
    | "objective_completed"
    | "contact_requested"
    | "contact_granted"
    | "contact_blocked"
    | "message_sent"
    | "other";
  timestamp: string;
  weight?: number;
}

export interface UnifiedUrgencySignal {
  source:
    | "deadline"
    | "stalled_objective"
    | "unread_contact"
    | "failed_action"
    | "direct_user_signal"
    | "other";
  level: 1 | 2 | 3;
  observedAt?: string;
  note?: string;
}

export interface UnifiedResolveOptions {
  situation?: {
    activeObjectives?: UnifiedSituationObjective[];
    recentEvents?: UnifiedSituationEvent[];
    urgencySignals?: UnifiedUrgencySignal[];
    now?: string;
  };
  trust?: {
    userId?: string;
    countyFips?: string;
    cvsScore?: number | null;
    verifiedJobsCount?: number | null;
    verifiedRecommendationsCount?: number | null;
    verificationStatus?: "approved" | "pending" | "rejected" | "suspended" | "unknown";
    riskFlags?: string[];
    confidenceLevel?: "low" | "medium" | "high";
  };
  tone?: {
    scenario?:
      | "default"
      | "technical_fallback"
      | "confidence_low"
      | "blocked_action"
      | "next_step_prompt";
    countyLabel?: string;
    roleLabel?: string;
    includeNextStep?: boolean;
  };
}

class RoutingCache {
  private readonly cache = new Map<string, { decision: UnifiedRoutingDecision; ts: number }>();
  private readonly ttlMs = 5 * 60 * 1000;

  private key(intent: string, userRole?: string, options?: UnifiedResolveOptions): string {
    const signature = options ? JSON.stringify(options) : "";
    return `${intent.toLowerCase().trim()}::${(userRole || "guest").toLowerCase()}::${signature}`;
  }

  get(
    intent: string,
    userRole?: string,
    options?: UnifiedResolveOptions
  ): UnifiedRoutingDecision | null {
    const entry = this.cache.get(this.key(intent, userRole, options));
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this.cache.delete(this.key(intent, userRole, options));
      return null;
    }
    return entry.decision;
  }

  set(
    intent: string,
    userRole: string | undefined,
    options: UnifiedResolveOptions | undefined,
    decision: UnifiedRoutingDecision
  ): void {
    this.cache.set(this.key(intent, userRole, options), { decision, ts: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; ttlMs: number } {
    return { size: this.cache.size, ttlMs: this.ttlMs };
  }
}

export class UnifiedScoutRouterClient {
  private static readonly apiBases = ["/api/scout/routing", "/api/assistant/routing"] as const;
  private static readonly cache = new RoutingCache();

  private static async postRouting(path: string, payload: Record<string, unknown>) {
    for (const apiBase of this.apiBases) {
      try {
        const res = await fetch(`${apiBase}${path}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 404) {
          return res;
        }
        return res;
      } catch {
        continue;
      }
    }
    return null;
  }

  static async resolveIntent(
    intent: string,
    userContext: UnifiedRouterUserContext,
    options?: UnifiedResolveOptions
  ): Promise<UnifiedRoutingDecision | null> {
    const cached = this.cache.get(intent, userContext.userRole, options);
    if (cached) return cached;

    try {
      const res = await this.postRouting("/resolve-intent", { intent, userContext, ...options });

      if (!res) {
        return this.localFallbackDecision(intent);
      }

      if (!res.ok) return this.localFallbackDecision(intent);

      const decision = (await res.json()) as UnifiedRoutingDecision;
      this.cache.set(intent, userContext.userRole, options, decision);
      return decision;
    } catch {
      return this.localFallbackDecision(intent);
    }
  }

  static async validateAction(
    action: ScoutAction,
    userContext: UnifiedRouterUserContext
  ): Promise<UnifiedActionValidation> {
    try {
      const res = await this.postRouting("/validate-action", { action, userContext });

      if (!res || !res.ok) return this.localValidate(action, userContext);
      return (await res.json()) as UnifiedActionValidation;
    } catch {
      return this.localValidate(action, userContext);
    }
  }

  static async discoverFeatures(query: string, userContext: UnifiedRouterUserContext) {
    try {
      const res = await this.postRouting("/discover-features", { query, userContext });
      if (!res || !res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  static async generateFallbackActions(
    originalIntent: string,
    failureReason: string,
    userContext: UnifiedRouterUserContext
  ): Promise<ScoutAction[]> {
    try {
      const res = await this.postRouting("/generate-fallback", {
        originalIntent,
        failureReason,
        userContext,
      });
      if (!res || !res.ok) return this.localFallbackActions();
      return (await res.json()) as ScoutAction[];
    } catch {
      return this.localFallbackActions();
    }
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static getCacheStats(): { size: number; ttlMs: number } {
    return this.cache.stats();
  }

  private static localFallbackDecision(intent: string): UnifiedRoutingDecision | null {
    const lower = intent.toLowerCase();
    if (lower.includes("direct") || lower.includes("connect")) {
      return {
        action: { type: "NAVIGATE", to: "/direct-connect", label: "Direct Connect" },
        confidence: 0.65,
        reasoning: "Local fallback matched direct-connect intent",
        sourceLayer: "fallback",
      };
    }
    if (lower.includes("community") || lower.includes("hoa") || lower.includes("group")) {
      return {
        action: { type: "NAVIGATE", to: "/community", label: "Community" },
        confidence: 0.65,
        reasoning: "Local fallback matched community intent",
        sourceLayer: "fallback",
      };
    }
    if (lower.includes("exchange") || lower.includes("market") || lower.includes("sell")) {
      return {
        action: { type: "NAVIGATE", to: "/exchange", label: "Exchange" },
        confidence: 0.65,
        reasoning: "Local fallback matched exchange intent",
        sourceLayer: "fallback",
      };
    }
    return null;
  }

  private static localValidate(
    action: ScoutAction,
    userContext: UnifiedRouterUserContext
  ): UnifiedActionValidation {
    const requiresAuth = new Set([
      "FOLLOW_USER",
      "UNFOLLOW_USER",
      "START_COMMUNITY_VAULT_DONATION",
      "START_PLATFORM_SUPPORT",
      "SEND_ADMIN_BROADCAST",
    ]);
    if (requiresAuth.has(action.type) && !userContext.isAuthenticated) {
      return {
        valid: false,
        reason: "This action requires authentication",
        metadata: { requiresAuth: true },
      };
    }

    if (action.type === "SEND_ADMIN_BROADCAST") {
      const role = String(userContext.userRole || "").toLowerCase();
      if (!["admin", "super_admin", "owner", "head_admin"].includes(role)) {
        return {
          valid: false,
          reason: "This action requires admin privileges",
          metadata: { requiresRole: "admin" },
        };
      }
    }

    if (action.type === "NAVIGATE" || action.type === "EXTERNAL_LINK") {
      const destination = action.to ?? action.path;
      if (destination && !this.isUrlSafe(destination)) {
        return { valid: false, reason: "This URL is not allowed" };
      }
    }

    return { valid: true };
  }

  private static localFallbackActions(): ScoutAction[] {
    return [
      { type: "NAVIGATE", to: "/direct-connect", label: "Open Direct Connect" },
      { type: "NAVIGATE", to: "/community", label: "Open Community" },
      { type: "NAVIGATE", to: "/exchange", label: "Open Exchange" },
    ];
  }

  private static isUrlSafe(url: string): boolean {
    if (url.startsWith("/")) return true;
    if (/^(mailto|tel|sms):/i.test(url)) return true;
    if (/^https:\/\//i.test(url)) return true;
    return false;
  }
}
