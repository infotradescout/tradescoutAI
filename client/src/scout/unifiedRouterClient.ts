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

class RoutingCache {
  private readonly cache = new Map<string, { decision: UnifiedRoutingDecision; ts: number }>();
  private readonly ttlMs = 5 * 60 * 1000;

  private key(intent: string, userRole?: string): string {
    return `${intent.toLowerCase().trim()}::${(userRole || "guest").toLowerCase()}`;
  }

  get(intent: string, userRole?: string): UnifiedRoutingDecision | null {
    const entry = this.cache.get(this.key(intent, userRole));
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this.cache.delete(this.key(intent, userRole));
      return null;
    }
    return entry.decision;
  }

  set(intent: string, userRole: string | undefined, decision: UnifiedRoutingDecision): void {
    this.cache.set(this.key(intent, userRole), { decision, ts: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; ttlMs: number } {
    return { size: this.cache.size, ttlMs: this.ttlMs };
  }
}

export class UnifiedScoutRouterClient {
  private static readonly apiBase = "/api/scout/routing";
  private static readonly cache = new RoutingCache();

  static async resolveIntent(
    intent: string,
    userContext: UnifiedRouterUserContext
  ): Promise<UnifiedRoutingDecision | null> {
    const cached = this.cache.get(intent, userContext.userRole);
    if (cached) return cached;

    try {
      const res = await fetch(`${this.apiBase}/resolve-intent`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, userContext }),
      });

      if (!res.ok) {
        if (res.status === 404) return null;
        return this.localFallbackDecision(intent);
      }

      const decision = (await res.json()) as UnifiedRoutingDecision;
      this.cache.set(intent, userContext.userRole, decision);
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
      const res = await fetch(`${this.apiBase}/validate-action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userContext }),
      });

      if (!res.ok) return this.localValidate(action, userContext);
      return (await res.json()) as UnifiedActionValidation;
    } catch {
      return this.localValidate(action, userContext);
    }
  }

  static async discoverFeatures(query: string, userContext: UnifiedRouterUserContext) {
    try {
      const res = await fetch(`${this.apiBase}/discover-features`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, userContext }),
      });
      if (!res.ok) return [];
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
      const res = await fetch(`${this.apiBase}/generate-fallback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalIntent, failureReason, userContext }),
      });
      if (!res.ok) return this.localFallbackActions();
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
