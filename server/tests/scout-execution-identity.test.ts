import { describe, expect, it } from "vitest";
import { buildScoutResultContractV1 } from "../scout/scoutResultContractV1";
import { scoutAllowedActionToAction } from "../../client/src/scout/actionValidation";

const build = (executionId?: string) => buildScoutResultContractV1({
  requestMessage: "Update my profile first name to Jane",
  source: { intent: "profile_update" },
  answer: "Review this update before saving.",
  actions: [{ type: "SAVE_PROFILE", label: "Save profile update", payload: {
    profilePatch: { firstName: "Jane" }, ...(executionId ? { executionId } : {}),
  } }],
});

describe("Scout prepared-operation identity", () => {
  it("issues an opaque identity without accepting an LLM-supplied key", () => {
    const action = build("model-chosen-execution-id").allowed_actions[0];
    expect(action.payload?.executionId).toMatch(/^[a-f0-9-]{36}$/);
    expect(action.payload?.executionId).not.toBe("model-chosen-execution-id");
    expect(action.requires_confirmation).toBe(true);
  });
  it("preserves identity through persisted JSON and the real client validator", () => {
    const result = build();
    const restored = JSON.parse(JSON.stringify(result));
    const first = scoutAllowedActionToAction(result.allowed_actions[0]);
    const second = scoutAllowedActionToAction(restored.allowed_actions[0]);
    expect(first?.type).toBe("SAVE_PROFILE");
    expect(first?.payload?.executionId).toBe(second?.payload?.executionId);
    expect(first?.payload?.requiresApproval).toBe(true);
  });
  it("does not confuse a new operation with a previous equal-valued update", () => {
    expect(build().allowed_actions[0].payload?.executionId)
      .not.toBe(build().allowed_actions[0].payload?.executionId);
  });
  it("does not add execution identity to navigation or payment handoffs", () => {
    const result = buildScoutResultContractV1({ source: {}, answer: "Open your workspace.", actions: [
      { type: "NAVIGATE", label: "Open Home Vault", to: "/homes" },
      { type: "START_PLATFORM_SUPPORT", label: "Support", payload: { amount: 25 } },
    ] });
    for (const action of result.allowed_actions) expect(action.payload?.executionId).toBeUndefined();
  });
  it("does not mutate the source action or its approved profile fields", () => {
    const payload = { profilePatch: { firstName: "Jane" } };
    const result = buildScoutResultContractV1({ source: {}, answer: "Review.", actions: [
      { type: "SAVE_PROFILE", label: "Save", payload },
    ] });
    expect(payload).toEqual({ profilePatch: { firstName: "Jane" } });
    expect(result.allowed_actions[0].payload?.profilePatch).toEqual(payload.profilePatch);
  });
});
