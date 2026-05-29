export type HomeIdPacketReadinessState = "needs_info" | "draft" | "ready_for_handoff";

export type HomeIdPacketReadinessInput = {
  homeId: string | null;
  requestType: string;
  selectedDetailIds: string[];
  missingHelpfulInfoCount: number;
  isDbSaved: boolean;
};

export type HomeIdPacketReadinessResult = {
  state: HomeIdPacketReadinessState;
  missing: string[];
};

export function evaluateHomeIdPacketReadiness(
  input: HomeIdPacketReadinessInput
): HomeIdPacketReadinessResult {
  const missing: string[] = [];
  const requestType = input.requestType.trim();
  const hasHomeId = Boolean(input.homeId && input.homeId.trim());
  const selectedCount = input.selectedDetailIds.filter(Boolean).length;

  if (!hasHomeId) missing.push("HomeID must exist");
  if (!requestType) missing.push("Select a request type");
  if (selectedCount < 1) missing.push("Select at least one HomeID detail");
  if (input.missingHelpfulInfoCount > 0) missing.push("Resolve blocking missing info");

  if (missing.length > 0) return { state: "needs_info", missing };
  if (!input.isDbSaved) {
    return { state: "draft", missing: ["Save packet to HomeID persistence"] };
  }
  return { state: "ready_for_handoff", missing: [] };
}
