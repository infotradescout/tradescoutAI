import { useQuery } from "@tanstack/react-query";

export interface CommunityAuthoritySurfaces {
  observationModeEnabled: boolean;
  phase2bAuthorityLabelsEnabled: boolean;
  phase2cOutcomeWeightingEnabled: boolean;
}

const DEFAULT_SURFACES: CommunityAuthoritySurfaces = {
  observationModeEnabled: true,
  phase2bAuthorityLabelsEnabled: false,
  phase2cOutcomeWeightingEnabled: false,
};

export function useCommunityAuthoritySurfaces() {
  return useQuery<CommunityAuthoritySurfaces>({
    queryKey: ["/api/community/authority-surfaces"],
    queryFn: async () => {
      const response = await fetch("/api/community/authority-surfaces", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return DEFAULT_SURFACES;
      }
      const parsed = await response.json().catch(() => null);
      if (!parsed || typeof parsed !== "object") {
        return DEFAULT_SURFACES;
      }
      return {
        observationModeEnabled: parsed.observationModeEnabled !== false,
        phase2bAuthorityLabelsEnabled: parsed.phase2bAuthorityLabelsEnabled === true,
        phase2cOutcomeWeightingEnabled: parsed.phase2cOutcomeWeightingEnabled === true,
      };
    },
    staleTime: 30_000,
    retry: false,
  });
}
