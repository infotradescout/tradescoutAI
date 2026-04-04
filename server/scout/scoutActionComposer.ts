import type { ScoutActionContract } from "../../shared/types/scout";

export function composeScoutActions(actions: unknown): ScoutActionContract[] {
  if (!Array.isArray(actions)) return [];

  return actions
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      type: String(item.type || "").trim(),
      label: String(item.label || "").trim(),
      ...(typeof item.to === "string" ? { to: item.to } : {}),
      ...(typeof item.path === "string" ? { path: item.path } : {}),
      ...(typeof item.subtitle === "string" ? { subtitle: item.subtitle } : {}),
      ...(typeof item.why === "string" ? { why: item.why } : {}),
      ...(typeof item.primary === "boolean" ? { primary: item.primary } : {}),
      ...(item.payload && typeof item.payload === "object" ? { payload: item.payload } : {}),
    }))
    .filter((item) => item.type.length > 0 && item.label.length > 0)
    .slice(0, 10);
}
