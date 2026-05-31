import { beforeEach, describe, expect, it, vi } from "vitest";

const { trackShellEventMock } = vi.hoisted(() => ({
  trackShellEventMock: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  getDeviceType: () => "desktop",
  trackShellEvent: trackShellEventMock,
}));

import {
  __resetFirstUseAnalyticsSeenForTests,
  trackFirstUseGuidanceViewed,
  trackFirstUseLauncherViewed,
  trackFirstUseOptionClicked,
  trackFirstUseTaskPromptClicked,
  trackFirstUseTaskPromptViewed,
} from "./firstUseAnalytics";

describe("firstUseAnalytics", () => {
  beforeEach(() => {
    trackShellEventMock.mockClear();
    __resetFirstUseAnalyticsSeenForTests();
  });

  it("dedupes viewed events on rerender-equivalent calls", () => {
    trackFirstUseGuidanceViewed("landing", "anonymous");
    trackFirstUseGuidanceViewed("landing", "anonymous");
    trackFirstUseLauncherViewed("landing", "anonymous");
    trackFirstUseLauncherViewed("landing", "anonymous");
    trackFirstUseTaskPromptViewed({
      surface: "homes",
      promptMessage: "Add one home detail.",
      ctaLabel: "Add home detail",
      userState: "authenticated",
    });
    trackFirstUseTaskPromptViewed({
      surface: "homes",
      promptMessage: "Add one home detail.",
      ctaLabel: "Add home detail",
      userState: "authenticated",
    });

    const eventTypes = trackShellEventMock.mock.calls.map((c) => c[0]?.type);
    expect(eventTypes).toEqual([
      "first_use_guidance_viewed",
      "first_use_launcher_viewed",
      "first_use_task_prompt_viewed",
    ]);
  });

  it("does not dedupe click events", () => {
    trackFirstUseOptionClicked({
      surface: "home",
      optionId: "keep_track",
      targetRoute: "/homes",
      userState: "authenticated",
    });
    trackFirstUseOptionClicked({
      surface: "home",
      optionId: "keep_track",
      targetRoute: "/homes",
      userState: "authenticated",
    });
    trackFirstUseTaskPromptClicked({
      surface: "direct_connect",
      promptMessage: "Start a local work request.",
      ctaLabel: "Start request",
      targetRoute: "/direct-connect",
      userState: "authenticated",
    });
    trackFirstUseTaskPromptClicked({
      surface: "direct_connect",
      promptMessage: "Start a local work request.",
      ctaLabel: "Start request",
      targetRoute: "/direct-connect",
      userState: "authenticated",
    });

    const eventTypes = trackShellEventMock.mock.calls.map((c) => c[0]?.type);
    expect(eventTypes).toEqual([
      "first_use_option_clicked",
      "first_use_option_clicked",
      "first_use_task_prompt_clicked",
      "first_use_task_prompt_clicked",
    ]);
  });
});
