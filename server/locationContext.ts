export type LocationLayer = "project" | "hoa" | "county" | "global";

export type LocationContext = {
  layer: LocationLayer;
  stateCode?: string;
  countyFips?: string;
  hoaId?: string;
  projectId?: string;
};

export type CountyWriteContext = {
  scope: "county";
  stateCode: string;
  countyFips: string;
};

type CountyIdentityRecord = {
  fips?: unknown;
  stateCode?: unknown;
};

function normalizeStateCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

function normalizeCountyFips(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return /^\d{5}$/.test(normalized) ? normalized : undefined;
}

function resolvePersistedStateCode(user: any): string | undefined {
  const canonicalStateCode =
    typeof user?.stateCode === "string" && user.stateCode.trim().length > 0
      ? user.stateCode
      : undefined;

  return normalizeStateCode(canonicalStateCode ?? user?.state);
}

export function getUserLocationContext(
  user: any,
  overrides?: Partial<LocationContext>
): LocationContext {
  const stateCode = resolvePersistedStateCode(user);
  const countyFips = normalizeCountyFips(user?.countyFips);

  const base: LocationContext = {
    layer: stateCode && countyFips ? "county" : "global",
    stateCode,
    countyFips,
  };

  return { ...base, ...overrides };
}

export async function resolveUserCountyWriteContext(
  user: any,
  getCountyByFips: (countyFips: string) => Promise<CountyIdentityRecord | undefined>
): Promise<CountyWriteContext | undefined> {
  const persistedContext = getUserLocationContext(user);
  if (
    persistedContext.layer !== "county" ||
    !persistedContext.stateCode ||
    !persistedContext.countyFips
  ) {
    return undefined;
  }

  const county = await getCountyByFips(persistedContext.countyFips);
  const countyStateCode = normalizeStateCode(county?.stateCode);
  const countyFips = normalizeCountyFips(county?.fips);

  if (
    countyStateCode !== persistedContext.stateCode ||
    countyFips !== persistedContext.countyFips
  ) {
    return undefined;
  }

  return {
    scope: "county",
    stateCode: countyStateCode,
    countyFips,
  };
}
