export type DeviceType = "desktop" | "mobile";

export type ShellEvent =
  | {
      type: "community_shell_nav_click";
      fromPath: string;
      toPath: string;
      deviceType: DeviceType;
      hasUnreadNotifications: boolean;
    }
  | {
      type: "community_shell_load";
      path: string;
      deviceType: DeviceType;
      hasUnreadNotifications: boolean;
      locationSet: boolean;
    }
  | {
      type: "community_shell_scaffold_click";
      section: string;
      deviceType: DeviceType;
      hasUnreadNotifications: boolean;
    }
  | {
      // Generic catch-all (used by /api/scout logScoutInsight)
      type: "scout_query";
      payload: unknown;
    }
  | {
      type: "identity_session";
      isAuthenticated: boolean;
      entryRoute: "login" | "register" | "oauth" | "other";
      userTypesCount: number;
      userTypes: string[];
      hasCompletedProfileBasics: boolean;
    }
  | {
      type: "dashboard_banner_shown";
      sessionCount: number;
      userTypes: string[];
      route: string;
    }
  | {
      type: "dashboard_banner_dismissed";
      sessionCount: number;
      userTypes: string[];
      route: string;
    }
  | {
      type: "help_article_viewed";
      payload: {
        articleId: string;
        title: string;
        category?: string;
        ts: string;
      };
    }
  | {
      type: "scout_draft_created" | "scout_draft_viewed";
      draftKind: "promo" | "community";
      path: string;
      ts: string;
      deviceType: DeviceType;
      stateCode?: string;
      countyFips?: string;
    }
  | {
      type: "scout_draft_published";
      draftKind: "promo" | "community";
      path: string;
      ts: string;
      deviceType: DeviceType;
      timeToPublishMs?: number;
      stateCode?: string;
      countyFips?: string;
    }
  | {
      type: "local_action_outcome";
      actionType: "community_notice" | "provider_coordination" | "promotion";
      result: "success" | "pending" | "failed";
      stateCode?: string;
      countyFips?: string;
      initiatedBy?: "scout" | "direct";
      timeToOutcomeMs?: number;
      artifactId?: string;
    }
  | {
      type: "client_runtime_error";
      source: "error" | "unhandledrejection";
      message: string;
      stack?: string | null;
      path: string;
      ts: string;
    }
  | {
      type: "progressive_exposure_shadow";
      tier: 0 | 1 | 2 | 3;
      reasons: string[];
      accountAgeDays: number;
      meaningfulActivityCount: number;
      hasCompletedSetup: boolean;
      hasVerifiedContact: boolean;
      path: string;
      ts: string;
    }
  // ── Onboarding funnel events ─────────────────────────────────────────────
  | {
      /** User landed on pre-scout-setup (the very first step) */
      type: "onboarding_funnel_started";
      presenceType: "personal" | "represent_business" | null;
      mode: "create" | "login" | string;
      ts: string;
    }
  | {
      /** User submitted the pre-scout-setup form and moved to onboarding/profile */
      type: "onboarding_profile_submitted";
      presenceType: "personal" | "represent_business" | null;
      hasBusinessName: boolean;
      hasCountyFips: boolean;
      locationSource: "places" | "manual" | "none" | null;
      ts: string;
    }
  | {
      /** User completed the onboarding/profile step and moved to onboarding/intent */
      type: "onboarding_profile_completed";
      presenceType: "personal" | "represent_business" | null;
      profileVersion: number;
      ts: string;
    }
  | {
      /** User chose an intent on the onboarding/intent step */
      type: "onboarding_intent_chosen";
      intent: "community" | "services" | "business" | "tools";
      presenceType: "personal" | "represent_business" | null;
      destination: string;
      ts: string;
    }
  | {
      /** User skipped the intent step */
      type: "onboarding_intent_skipped";
      presenceType: "personal" | "represent_business" | null;
      destination: string;
      ts: string;
    }
  | {
      /** Onboarding fully completed (complete-onboarding API call succeeded) */
      type: "onboarding_completed";
      presenceType: "personal" | "represent_business" | null;
      draftPromoted: boolean;
      destination: string;
      ts: string;
    }
  // ── Direct Connect funnel events ────────────────────────────────────────
  | {
      type: "direct_connect_landed";
      section: string;
      entry: string | null;
      deviceType: DeviceType;
      isAuthenticated: boolean;
      hasCountyFips: boolean;
      ts: string;
    }
  | {
      type: "direct_connect_entry_resolved";
      entry: string;
      fromSection: string;
      toSection: string;
      reason: "replies" | "open_requests" | "new_request";
      deviceType: DeviceType;
      replyCount: number;
      openRequestCount: number;
      ts: string;
    }
  | {
      type: "direct_connect_tab_selected";
      fromSection: string;
      toSection: string;
      entry: string | null;
      deviceType: DeviceType;
      ts: string;
    }
  | {
      type: "direct_connect_request_started";
      category: string;
      field: "type" | "title" | "description" | "attachment" | "budget";
      source?: string | null;
      deviceType: DeviceType;
      ts: string;
    }
  | {
      type: "direct_connect_request_submitted";
      category: string;
      hasBudget: boolean;
      attachmentCount: number;
      dispatchMode: string;
      dispatchCount?: number | null;
      directTargets: number;
      deviceType: DeviceType;
      ts: string;
    };

export function getDeviceType(): DeviceType {
  if (typeof window === "undefined") {
    return "desktop";
  }
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

export async function trackShellEvent(event: ShellEvent) {
  // In development, skip hitting the server entirely.
  // This keeps your DevTools clean and avoids noise while you build.
  if (import.meta.env.DEV) {
    return;
  }

  try {
    const res = await fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    // In production, only warn on "real" failures.
    if (!res.ok && res.status !== 401 && import.meta.env.PROD) {
      console.warn("Shell analytics failed", res.status);
    }
  } catch (err) {
    if (import.meta.env.PROD) {
      console.error("Shell analytics error", err);
    }
  }
}
