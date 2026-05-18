/**
 * resolvePostOnboardingActions
 * Pure function: claims → PostOnboardingAction[]
 *
 * No state, no side effects, no LLM calls.
 * Deterministic: same claims → same actions every time.
 */

import type { ClaimType } from "./claimTypes";
import type { PostOnboardingAction } from "./scoutModeTypes";

export interface PublishedProfile {
  slug: string;
  businessName?: string;
}

/**
 * Resolve action set based on confirmed claims
 * Actions are ordered by priority; duplicates are removed
 */
export function resolvePostOnboardingActions(
  claims: ClaimType[],
  profile: PublishedProfile
): PostOnboardingAction[] {
  const actions: PostOnboardingAction[] = [];

  // offer_services: primary actions are setting up services + viewing page
  if (claims.includes("offer_services")) {
    actions.push({
      id: "setup_services",
      label: "Set up profile, offers & verification",
      destination: "/offer-services",
      primary: true,
    });
    actions.push({
      id: "setup_fixed_price_offers",
      label: "Add fixed-price services or items",
      destination: "/offer-services#fixed-price-offers",
    });
    actions.push({
      id: "review_finance_records",
      label: "Review finance records",
      destination: "/finances/records",
    });
    actions.push({
      id: "view_page",
      label: "View your business page",
      destination: `/business/${profile.slug}`,
    });
  }

  // find_help: primary actions are posting a request + browsing nearby help
  if (claims.includes("find_help")) {
    actions.push({
      id: "post_request",
      label: "Post a request",
      destination: "/direct-connect/new",
      primary: !claims.includes("offer_services"), // Primary only if not offering services
    });
    actions.push({
      id: "browse_providers",
      label: "Find local help",
      destination: "/community",
    });
  }

  // represent_business: manage profile is a key action
  if (claims.includes("represent_business") && !claims.includes("offer_services")) {
    actions.push({
      id: "manage_profile",
      label: "Manage your business profile",
      destination: `/business/${profile.slug}/edit`,
      primary: true,
    });
  }

  // Always include explore and ask scout (regardless of claims)
  if (!actions.some((a) => a.id === "explore")) {
    actions.push({
      id: "explore",
      label: "Explore the community",
      destination: "/community",
    });
  }

  actions.push({
    id: "ask_scout",
    label: "Ask Scout a question",
    destination: "/scout",
  });

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped: PostOnboardingAction[] = [];
  for (const action of actions) {
    if (!seen.has(action.id)) {
      seen.add(action.id);
      deduped.push(action);
    }
  }

  return deduped;
}
