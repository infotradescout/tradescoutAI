type ProviderBehaviorAction = {
  type: string;
  path?: string;
  to?: string;
  label: string;
  subtitle?: string;
  why?: string;
  primary?: boolean;
};

type ApplyProviderBehaviorInput = {
  actions: ProviderBehaviorAction[];
  intentCategory?: string;
  intentSlug?: string;
};

export function applyProviderBehaviorOwnership(
  input: ApplyProviderBehaviorInput
): ProviderBehaviorAction[] {
  const nextActions = Array.isArray(input.actions) ? input.actions.slice() : [];

  const shouldPairHireDIY =
    input.intentCategory === "how_to" || input.intentCategory === "provider_search";

  if (!shouldPairHireDIY) {
    return nextActions;
  }

  const hireAction: ProviderBehaviorAction = {
    type: "NAVIGATE",
    path: "/direct-connect",
    to: "/direct-connect",
    label: "Create a Direct Connect request",
    subtitle: "Fastest way to coordinate locally",
    why: "Community coordination improves outcomes and saves time",
    primary: true,
  };

  const slug =
    typeof input.intentSlug === "string" && input.intentSlug.trim() ? input.intentSlug : "how-to";

  const diyAction: ProviderBehaviorAction = {
    type: "NAVIGATE",
    path: `/learn/${slug}`,
    to: `/learn/${slug}`,
    label: "Try fixing it yourself",
    subtitle: "DIY steps and safety tips",
    why: "If you prefer to handle it on your own",
    primary: false,
  };

  return [hireAction, diyAction, ...nextActions];
}
