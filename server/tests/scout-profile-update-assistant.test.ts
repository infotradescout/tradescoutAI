import { describe, expect, it } from "vitest";
import {
  buildScoutProfileUpdateResponse,
  inferScoutProfileUpdateDraft,
  sanitizeScoutProfileUpdatePayload,
} from "../scout/scoutProfileUpdateAssistant";

describe("Scout profile update assistant", () => {
  it("drafts safe profile basics from explicit user input", () => {
    const draft = inferScoutProfileUpdateDraft(
      "Update my profile: my name is Jane Smith, my phone is (850) 555-1212, I live in Pensacola, FL"
    );

    expect(draft?.profilePatch).toMatchObject({
      firstName: "Jane",
      lastName: "Smith",
      phone: "(850) 555-1212",
      city: "Pensacola",
      state: "FL",
      stateCode: "FL",
    });
    expect(draft?.labels).toEqual(expect.arrayContaining(["name", "phone", "location"]));
  });

  it("drafts profile text without changing trust or visibility fields", () => {
    const draft = inferScoutProfileUpdateDraft(
      "Add services to my profile: I offer plumbing, drain cleaning, and water heater repair"
    );
    const response = buildScoutProfileUpdateResponse(draft!);

    expect(draft?.preferencesPatch.servicesDescription).toContain("plumbing");
    expect(response.actions[0].type).toBe("SAVE_PROFILE");
    expect(response.actions[0].payload).toMatchObject({
      preferencesPatch: {
        servicesDescription: expect.stringContaining("water heater"),
      },
    });

    const serialized = JSON.stringify(response).toLowerCase();
    expect(serialized).not.toContain("verificationstatus");
    expect(serialized).not.toContain("trustlevel");
    expect(serialized).not.toContain("profilevisibility");
    expect(serialized).not.toContain("countyfips");
  });

  it("asks for clarification when the user asks to update profile without a value", () => {
    const draft = inferScoutProfileUpdateDraft("Update my profile");
    const response = buildScoutProfileUpdateResponse(draft!);

    expect(response.actions[0]).toMatchObject({
      type: "NAVIGATE",
      to: "/profile-settings",
    });
    expect(response.metadata.confidenceBand).toBe("medium");
  });

  it("sanitizes save payloads to the allowed profile field set", () => {
    const sanitized = sanitizeScoutProfileUpdatePayload({
      profilePatch: {
        firstName: " Alex ",
        countyFips: "12033",
        verificationStatus: "approved",
        trustLevel: "high",
      },
      preferencesPatch: {
        bio: "Local helper",
        profileVisibility: "public",
      },
    });

    expect(sanitized.profilePatch).toEqual({ firstName: "Alex" });
    expect(sanitized.preferencesPatch).toEqual({ bio: "Local helper" });
  });
});
