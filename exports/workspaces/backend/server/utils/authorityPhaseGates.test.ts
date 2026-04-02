import { describe, expect, it } from "vitest";
import { deriveAuthorityPhaseGateState } from "./authorityPhaseGates";

describe("deriveAuthorityPhaseGateState", () => {
  it("defaults to observation lock with both phases disabled", () => {
    const state = deriveAuthorityPhaseGateState({});

    expect(state.observationModeEnabled).toBe(true);
    expect(state.phase2bRequested).toBe(false);
    expect(state.phase2cRequested).toBe(false);
    expect(state.phase2bAuthorityLabelsEnabled).toBe(false);
    expect(state.phase2cOutcomeWeightingEnabled).toBe(false);
    expect(state.phase2bBlockedReason).toBe("Observation mode lock is enabled");
    expect(state.phase2cBlockedReason).toBe("Observation mode lock is enabled");
  });

  it("enables phase 2B when observation lock is off and setting toggle is true", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: false,
      phase2bSetting: true,
    });

    expect(state.observationModeEnabled).toBe(false);
    expect(state.phase2bRequested).toBe(true);
    expect(state.phase2bAuthorityLabelsEnabled).toBe(true);
    expect(state.phase2bBlockedReason).toBeNull();
  });

  it("keeps phase 2C disabled until explicitly requested", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: false,
      phase2bSetting: true,
    });

    expect(state.phase2cRequested).toBe(false);
    expect(state.phase2cOutcomeWeightingEnabled).toBe(false);
    expect(state.phase2cBlockedReason).toBe("Phase 2C is not toggled on");
  });

  it("supports feature-flag based phase 2B request", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: false,
      phase2bFeatureFlagEnabled: true,
    });

    expect(state.phase2bRequested).toBe(true);
    expect(state.phase2bAuthorityLabelsEnabled).toBe(true);
  });

  it("supports env toggle based phase 2B request", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: false,
      envEnableAuthorityLabels: "true",
    });

    expect(state.phase2bRequested).toBe(true);
    expect(state.phase2bAuthorityLabelsEnabled).toBe(true);
  });

  it("does not enable phase 2C when phase 2B is not enabled", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: false,
      phase2cSetting: true,
    });

    expect(state.phase2cRequested).toBe(true);
    expect(state.phase2bAuthorityLabelsEnabled).toBe(false);
    expect(state.phase2cOutcomeWeightingEnabled).toBe(false);
    expect(state.phase2cBlockedReason).toBe("Phase 2B must be enabled first");
  });

  it("enables phase 2C only when phase 2B is enabled and 2C is requested", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: false,
      phase2bSetting: true,
      phase2cSetting: true,
    });

    expect(state.phase2bAuthorityLabelsEnabled).toBe(true);
    expect(state.phase2cRequested).toBe(true);
    expect(state.phase2cOutcomeWeightingEnabled).toBe(true);
    expect(state.phase2cBlockedReason).toBeNull();
  });

  it("enforces observation lock even when both phases are requested", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: true,
      phase2bSetting: true,
      phase2cSetting: true,
      envEnableAuthorityLabels: "1",
      envEnableOutcomeWeighting: "1",
    });

    expect(state.observationModeEnabled).toBe(true);
    expect(state.phase2bRequested).toBe(true);
    expect(state.phase2cRequested).toBe(true);
    expect(state.phase2bAuthorityLabelsEnabled).toBe(false);
    expect(state.phase2cOutcomeWeightingEnabled).toBe(false);
    expect(state.phase2bBlockedReason).toBe("Observation mode lock is enabled");
    expect(state.phase2cBlockedReason).toBe("Observation mode lock is enabled");
  });

  it("parses object-shaped setting values", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: { enabled: false },
      phase2bSetting: { enabled: true },
      phase2cSetting: { value: true },
    });

    expect(state.observationModeEnabled).toBe(false);
    expect(state.phase2bAuthorityLabelsEnabled).toBe(true);
    expect(state.phase2cOutcomeWeightingEnabled).toBe(true);
  });

  it("parses numeric toggles from settings", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: 0,
      phase2bSetting: 1,
      phase2cSetting: 1,
    });

    expect(state.observationModeEnabled).toBe(false);
    expect(state.phase2bAuthorityLabelsEnabled).toBe(true);
    expect(state.phase2cOutcomeWeightingEnabled).toBe(true);
  });

  it("returns an ISO timestamp", () => {
    const state = deriveAuthorityPhaseGateState({
      observationModeSetting: false,
      phase2bSetting: true,
    });

    expect(Number.isNaN(Date.parse(state.evaluatedAt))).toBe(false);
  });
});
