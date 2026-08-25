import { getOrCreateDiscoveryAnonymousSessionId } from "./discoveryLanding";

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
      type: "public_profile_direct_connect_opened";
      profileSlug: string;
      surface: "express_direct_connect_panel";
      route: string;
      deviceType: DeviceType;
      ts: string;
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
      source?: string | null;
      deviceType: DeviceType;
      ts: string;
    }
  | {
      type: "direct_connect_request_review_opened";
      category: string;
      hasBudget: boolean;
      attachmentCount: number;
      homeContextIntent:
        | "link_existing"
        | "create_from_request"
        | "update_from_request"
        | "skip_for_now";
      deviceType: DeviceType;
      ts: string;
    }
  // ── First-use guidance KPI events ────────────────────────────────────────
  | {
      type:
        | "first_use_guidance_viewed"
        | "first_use_launcher_viewed"
        | "first_use_launcher_dismissed"
        | "first_use_launcher_restored";
      surface: "landing" | "home" | "homes" | "direct_connect" | "scout";
      userState: "anonymous" | "authenticated";
      viewport: DeviceType;
      ts: string;
    }
  | {
      type: "first_use_option_clicked";
      surface: "landing" | "home" | "homes" | "direct_connect" | "scout";
      optionId: string;
      targetRoute: string;
      userState: "anonymous" | "authenticated";
      viewport: DeviceType;
      ts: string;
    }
  | {
      type: "first_use_task_prompt_viewed" | "first_use_task_prompt_clicked";
      surface: "landing" | "home" | "homes" | "direct_connect" | "scout";
      promptMessage: string;
      ctaLabel: string;
      targetRoute?: string;
      userState: "anonymous" | "authenticated";
      viewport: DeviceType;
      ts: string;
    }
  // ── Core HomeID / Direct Connect / Scout KPI events ────────────────────
  | {
      type:
        | "homeid_started"
        | "homeid_first_detail_added"
        | "homeid_component_added"
        | "homeid_evidence_added"
        | "homeid_request_packet_created"
        | "homeid_request_packet_ready"
        | "homeid_direct_connect_draft_created"
        | "homeid_direct_connect_request_submitted";
      surface: "homes";
      userState: "anonymous" | "authenticated";
      viewport: DeviceType;
      source: string;
      homeId?: string;
      requestId?: string;
      packetId?: string;
      componentType?: string;
      ts: string;
    }
  | {
      type: "property_build_started" | "property_participant_invited" | "property_milestone_added";
      surface: "property_build";
      userState: "anonymous" | "authenticated";
      viewport: DeviceType;
      source: string;
      propertyProgramId?: string;
      role?: string;
      ts: string;
    }
  | {
      type:
        | "direct_connect_request_started"
        | "direct_connect_homeid_link_selected"
        | "direct_connect_home_record_prompt_viewed"
        | "direct_connect_home_record_link_selected"
        | "direct_connect_home_record_create_selected"
        | "direct_connect_home_record_skipped"
        | "direct_connect_request_submitted_after_home_record_skip"
        | "direct_connect_request_review_opened"
        | "direct_connect_request_submitted"
        | "direct_connect_visible_to_contractors"
        | "direct_connect_request_visible_to_contractors"
        | "direct_connect_contractor_action_started"
        | "direct_connect_requester_reply_viewed"
        | "direct_connect_homeid_created_from_request"
        | "direct_connect_homeid_updated_from_request";
      surface: "direct_connect";
      userState: "anonymous" | "authenticated";
      viewport: DeviceType;
      source: string;
      homeId?: string;
      requestId?: string;
      packetId?: string;
      componentType?: string;
      replyCount?: number;
      visibleContractorCount?: number;
      assignmentId?: string;
      decision?: string;
      responderType?: string;
      ts: string;
    }
  | {
      type: "scout_homeid_context_viewed" | "scout_homeid_action_card_clicked";
      surface: "scout";
      userState: "anonymous" | "authenticated";
      viewport: DeviceType;
      source: string;
      homeId?: string;
      actionCardType?: string;
      componentType?: string;
      requestId?: string;
      packetId?: string;
      ts: string;
    };

export function getDeviceType(): DeviceType {
  if (typeof window === "undefined") {
    return "desktop";
  }
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

function validAnonymousSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

export async function trackShellEvent(event: ShellEvent) {
  // In development, skip hitting the server entirely.
  // This keeps your DevTools clean and avoids noise while you build.
  if (import.meta.env.DEV) {
    return;
  }

  try {
    const anonymousSessionId =
      event.type === "public_profile_direct_connect_opened"
        ? getOrCreateDiscoveryAnonymousSessionId()
        : "";
    const payload = validAnonymousSessionId(anonymousSessionId)
      ? { ...event, anonymousSessionId }
      : event;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (validAnonymousSessionId(anonymousSessionId)) {
      headers["X-Anonymous-Session-Id"] = anonymousSessionId;
    }

    const res = await fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(payload),
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