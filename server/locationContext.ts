export type LocationLayer = "project" | "hoa" | "county" | "global";

export type LocationContext = {
  layer: LocationLayer;
  stateCode?: string;
  countyFips?: string;
  hoaId?: string;
  projectId?: string;
};

function normalizeStateCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized.length === 2 ? normalized : undefined;
}

function normalizeCountyFips(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length === 5 ? normalized : undefined;
}

export function getUserLocationContext(
  user: any,
  overrides?: Partial<LocationContext>
): LocationContext {
  const stateCode = normalizeStateCode(user?.stateCode || user?.state);
  const countyFips = normalizeCountyFips(user?.countyFips);

  const base: LocationContext = {
    layer: stateCode && countyFips ? "county" : "global",
    stateCode,
    countyFips,
  };

  return { ...base, ...overrides };
}
