import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROFILE_SURFACE_RULES,
  PROFILE_SURFACE_SHARED_ENGINES,
} from "@shared/profileSurfaceArchitecture";

function read(file: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
}

describe("profile mini surfaces use shared TradeScout engines", () => {
  it("keeps lightweight profile accounts on TradeScout identity without requiring full onboarding", () => {
    expect(PROFILE_SURFACE_SHARED_ENGINES.account).toBe("tradescout_identity");
    expect(PROFILE_SURFACE_RULES.profileAccountRequiresFullOnboarding).toBe(false);
    expect(PROFILE_SURFACE_RULES.profileAccountIsSeparateCredentialSystem).toBe(false);
    expect(PROFILE_SURFACE_RULES.fullTradeScoutOnboardingMayExpandSameIdentityLater).toBe(true);
  });

  it("keeps profile requests on Direct Connect authority", () => {
    expect(PROFILE_SURFACE_SHARED_ENGINES.request).toBe("direct_connect");
    expect(PROFILE_SURFACE_RULES.profileRequestIsSeparateRequestSystem).toBe(false);

    const express = read("server/routes/tradepartner-express.ts");
    expect(express).toContain("createExpressDirectConnectAuthority");
    expect(express).toContain('kind: "tradepartner_profile_express"');
  });

  it("keeps verification and messaging on shared platform authorities", () => {
    expect(PROFILE_SURFACE_SHARED_ENGINES.verification).toBe("tradescout_verification");
    expect(PROFILE_SURFACE_SHARED_ENGINES.messaging).toBe("direct_connect_messaging");
    expect(PROFILE_SURFACE_SHARED_ENGINES.notifications).toBe("tradescout_notifications");
  });
});
