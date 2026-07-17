import { buildProfileServiceOfferDecisionScope } from "@shared/profileOfferShare";

export type ProfileServiceOfferDecisionAuthority = {
  authorityGate: "decision_card";
  sourceDecisionCardId: string;
  decisionScope: string;
};

export async function createProfileServiceOfferDecisionAuthority(args: {
  offerId: unknown;
  title: unknown;
}): Promise<ProfileServiceOfferDecisionAuthority> {
  const decisionScope = buildProfileServiceOfferDecisionScope(args.offerId);
  if (!decisionScope) throw new Error("This service offer is not available");

  const title = typeof args.title === "string" && args.title.trim() ? args.title.trim() : "service";
  const response = await fetch("/api/decision-cards", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "hire",
      decisionScope,
      title: `Start service: ${title}`,
      description: `Create a protected job draft for ${title}.`,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Unable to record this protected hiring decision");
  }

  const sourceDecisionCardId = String(data?.id || "").trim();
  if (!sourceDecisionCardId) throw new Error("Unable to record this protected hiring decision");

  return {
    authorityGate: "decision_card",
    sourceDecisionCardId,
    decisionScope,
  };
}
