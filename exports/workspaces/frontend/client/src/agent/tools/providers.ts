import { apiRequest } from "@/lib/queryClient";

export type ProviderProfileProposalPayload = {
  displayName?: string;
  headline?: string;
  description?: string;
  services?: string[];
  serviceAreas?: {
    county?: string;
    state: string;
  }[];
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
};

export type ProviderProfileProposal = {
  type: "PROVIDER_PROFILE_PROPOSAL";
  payload: ProviderProfileProposalPayload & {
    proposedAt: number;
  };
};

export function proposeProviderProfileUpdate(
  input: ProviderProfileProposalPayload,
): ProviderProfileProposal {
  return {
    type: "PROVIDER_PROFILE_PROPOSAL",
    payload: {
      ...input,
      proposedAt: Date.now(),
    },
  };
}

export type ProviderRequirement = {
  trade: { tradeId: string; name: string; slug: string };
  jurisdiction?: { stateCode?: string; countyFips?: string };
  requires: { ein: boolean; license: boolean; insurance: boolean };
  notes?: string | null;
};

export async function getProviderRequirements(args: {
  tradeSlugs: string[];
  countyFips?: string;
}): Promise<ProviderRequirement[]> {
  const params = new URLSearchParams();
  for (const slug of args.tradeSlugs) {
    params.append("tradeSlug", slug);
  }
  if (args.countyFips) {
    params.set("countyFips", args.countyFips);
  }

  const response = (await apiRequest(
    "GET",
    `/api/providers/requirements?${params.toString()}`,
  )) as { requirements: ProviderRequirement[] };

  return response.requirements;
}

export type ProviderStandingRequirementsFlag = {
  required: boolean;
  has: boolean;
};

export type ProviderStanding = {
  county: {
    countyFips: string;
    countyName: string;
    stateCode: string;
  };
  declaration:
    | { hasDeclaration: false }
    | {
        hasDeclaration: true;
        tradeIds: string[];
        serviceAreas: { countyFips: string }[];
      };
  reach: {
    label: "not_set_up" | "local_here" | "regional_here" | "nearby_not_listed_here";
    servesThisCounty: boolean;
    declaredServiceAreaCount: number;
  };
  activity: {
    jobsCompleted: number;
    peopleHelped: number;
    activeWeeks: number;
    lastActiveAt: string | null;
  };
  requirements: {
    ein: ProviderStandingRequirementsFlag;
    license: ProviderStandingRequirementsFlag;
    insurance: ProviderStandingRequirementsFlag;
  };
  promotion: {
    blocked: boolean;
    reasons: string[];
  };
};

export async function getProviderStanding(args: {
  countyFips: string;
}): Promise<ProviderStanding> {
  const params = new URLSearchParams();
  params.set("countyFips", args.countyFips);

  const response = (await apiRequest(
    "GET",
    `/api/providers/standing?${params.toString()}`,
  )) as ProviderStanding;

  return response;
}
