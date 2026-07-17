import {
  buildHomeScoutInspectionRequestDecisionScope,
  buildHomeScoutInspectionServiceDecisionScope,
} from "@shared/homeScoutListingShare";

export type HomeScoutDecisionAuthority = {
  authorityGate: "decision_card";
  sourceDecisionCardId: string;
  decisionScope: string;
};

async function createHomeScoutDecisionAuthority(args: {
  decisionScope: string | null;
  title: string;
  description: string;
}): Promise<HomeScoutDecisionAuthority> {
  if (!args.decisionScope) throw new Error("This HomeScout action is not available");

  const response = await fetch("/api/decision-cards", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "hire",
      decisionScope: args.decisionScope,
      title: args.title,
      description: args.description,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Unable to record this protected hiring decision");
  }

  const sourceDecisionCardId = String(data?.id || "").trim();
  if (!sourceDecisionCardId) {
    throw new Error("Unable to record this protected hiring decision");
  }

  return {
    authorityGate: "decision_card",
    sourceDecisionCardId,
    decisionScope: args.decisionScope,
  };
}

export async function createHomeScoutInspectionRequestDecisionAuthority(args: {
  listingId: unknown;
  listingTitle: unknown;
}): Promise<HomeScoutDecisionAuthority> {
  const listingTitle =
    typeof args.listingTitle === "string" && args.listingTitle.trim()
      ? args.listingTitle.trim()
      : "this home";
  return createHomeScoutDecisionAuthority({
    decisionScope: buildHomeScoutInspectionRequestDecisionScope(args.listingId),
    title: `Request inspection: ${listingTitle}`,
    description: `Create a protected inspection request for ${listingTitle}.`,
  });
}

export async function createHomeScoutInspectionServiceDecisionAuthority(args: {
  reportId: unknown;
  listingTitle: unknown;
}): Promise<HomeScoutDecisionAuthority> {
  const listingTitle =
    typeof args.listingTitle === "string" && args.listingTitle.trim()
      ? args.listingTitle.trim()
      : "this home";
  return createHomeScoutDecisionAuthority({
    decisionScope: buildHomeScoutInspectionServiceDecisionScope(args.reportId),
    title: `Request repair follow-up: ${listingTitle}`,
    description: `Create a protected repair request from an inspection report for ${listingTitle}.`,
  });
}
