export type LocationLayer = "project" | "hoa" | "county" | "global";

export type LocationContext = {
  layer: LocationLayer;
  stateCode?: string;
  countyFips?: string;
  hoaId?: string;
  projectId?: string;
};

export function getUserLocationContext(
  user: any,
  overrides?: Partial<LocationContext>
): LocationContext {
  const base: LocationContext = {
    layer: "county",
    stateCode: user?.stateCode || user?.state || undefined,
    countyFips: user?.countyFips || undefined,
  };

  return { ...base, ...overrides };
}
