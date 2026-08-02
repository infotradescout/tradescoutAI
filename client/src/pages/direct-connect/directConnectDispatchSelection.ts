export type DirectConnectDispatchMode = "top_count" | "direct_pick";

export function resolveDirectConnectDispatchSelection({
  dispatchMode,
  topCountIds,
  prefillTargetProviderId,
}: {
  dispatchMode: DirectConnectDispatchMode;
  topCountIds: string[];
  prefillTargetProviderId?: string;
}): string[] {
  if (dispatchMode === "top_count") {
    return Array.from(new Set(topCountIds.map((id) => String(id || "").trim()).filter(Boolean)));
  }

  const prefilledProviderId = String(prefillTargetProviderId || "").trim();
  return prefilledProviderId ? [prefilledProviderId] : [];
}
