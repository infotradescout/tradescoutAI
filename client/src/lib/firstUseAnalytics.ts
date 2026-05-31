import { getDeviceType, trackShellEvent, type DeviceType } from "@/lib/analytics";

export type FirstUseSurface = "landing" | "home" | "homes" | "direct_connect" | "scout";
export type FirstUseUserState = "anonymous" | "authenticated";

type FirstUseBaseEvent = {
  surface: FirstUseSurface;
  userState: FirstUseUserState;
  viewport: DeviceType;
  ts: string;
};

const seenFirstUseViewEvents = new Set<string>();

function base(surface: FirstUseSurface, userState: FirstUseUserState): FirstUseBaseEvent {
  return {
    surface,
    userState,
    viewport: getDeviceType(),
    ts: new Date().toISOString(),
  };
}

function onceKey(type: string, surface: FirstUseSurface, userState: FirstUseUserState, extra = "") {
  return `${type}|${surface}|${userState}|${extra}`;
}

function shouldTrackOnce(key: string): boolean {
  if (seenFirstUseViewEvents.has(key)) return false;
  seenFirstUseViewEvents.add(key);
  return true;
}

// test hook only
export function __resetFirstUseAnalyticsSeenForTests() {
  seenFirstUseViewEvents.clear();
}

export function trackFirstUseGuidanceViewed(
  surface: FirstUseSurface,
  userState: FirstUseUserState
) {
  if (!shouldTrackOnce(onceKey("first_use_guidance_viewed", surface, userState))) return;
  void trackShellEvent({
    type: "first_use_guidance_viewed",
    ...base(surface, userState),
  });
}

export function trackFirstUseLauncherViewed(
  surface: FirstUseSurface,
  userState: FirstUseUserState
) {
  if (!shouldTrackOnce(onceKey("first_use_launcher_viewed", surface, userState))) return;
  void trackShellEvent({
    type: "first_use_launcher_viewed",
    ...base(surface, userState),
  });
}

export function trackFirstUseLauncherDismissed(
  surface: FirstUseSurface,
  userState: FirstUseUserState
) {
  void trackShellEvent({
    type: "first_use_launcher_dismissed",
    ...base(surface, userState),
  });
}

export function trackFirstUseLauncherRestored(
  surface: FirstUseSurface,
  userState: FirstUseUserState
) {
  void trackShellEvent({
    type: "first_use_launcher_restored",
    ...base(surface, userState),
  });
}

export function trackFirstUseOptionClicked(args: {
  surface: FirstUseSurface;
  optionId: string;
  targetRoute: string;
  userState: FirstUseUserState;
}) {
  void trackShellEvent({
    type: "first_use_option_clicked",
    optionId: args.optionId,
    targetRoute: args.targetRoute,
    ...base(args.surface, args.userState),
  });
}

export function trackFirstUseTaskPromptViewed(args: {
  surface: FirstUseSurface;
  promptMessage: string;
  ctaLabel: string;
  userState: FirstUseUserState;
}) {
  if (
    !shouldTrackOnce(
      onceKey(
        "first_use_task_prompt_viewed",
        args.surface,
        args.userState,
        `${args.promptMessage}|${args.ctaLabel}`
      )
    )
  ) {
    return;
  }
  void trackShellEvent({
    type: "first_use_task_prompt_viewed",
    promptMessage: args.promptMessage,
    ctaLabel: args.ctaLabel,
    ...base(args.surface, args.userState),
  });
}

export function trackFirstUseTaskPromptClicked(args: {
  surface: FirstUseSurface;
  promptMessage: string;
  ctaLabel: string;
  userState: FirstUseUserState;
  targetRoute?: string;
}) {
  void trackShellEvent({
    type: "first_use_task_prompt_clicked",
    promptMessage: args.promptMessage,
    ctaLabel: args.ctaLabel,
    targetRoute: args.targetRoute,
    ...base(args.surface, args.userState),
  });
}
