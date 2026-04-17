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
