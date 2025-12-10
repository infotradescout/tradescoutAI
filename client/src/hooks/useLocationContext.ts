import { useAuth } from "@/hooks/useAuth";

export type LocationLayer = "project" | "hoa" | "county" | "global";

export type LocationContext = {
  layer: LocationLayer;
  stateCode?: string;
  countyFips?: string;
  hoaId?: string;
  projectId?: string;
};

export function useLocationContext(
  overrides?: Partial<LocationContext>
): LocationContext {
  const { user } = useAuth() as any;

  const base: any = {
    layer: "county",
    stateCode: user?.state ?? user?.stateCode ?? undefined,
    countyFips: (user as any)?.countyFips ?? undefined,
  };

  if (user?.county) {
    base.county = user.county;
  }

  return { ...base, ...overrides };
}
