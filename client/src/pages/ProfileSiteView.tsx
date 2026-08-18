import { lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";

const JWStoneProfile = lazy(() => import("@/features/jw-stone/JWStoneProfile"));
const StandardProfileSiteView = lazy(() => import("./ProfileSiteViewLegacy"));

function resolveRequestedProfileSlug(location: string): string {
  const customDomainSlug =
    typeof window !== "undefined"
      ? String(
          (window as unknown as { __TS_CUSTOM_DOMAIN_PROFILE_SLUG__?: string })
            .__TS_CUSTOM_DOMAIN_PROFILE_SLUG__ || ""
        )
          .trim()
          .toLowerCase()
      : "";
  if (customDomainSlug) return customDomainSlug;

  const raw = String(location || "");
  const splitIndex = raw.search(/[?#]/);
  const pathOnly = (splitIndex >= 0 ? raw.slice(0, splitIndex) : raw).replace(/\/+$/, "") || "/";

  if (pathOnly === "/jw-stone" || pathOnly.startsWith("/jw-stone/")) {
    return JW_STONE_PROFILE_SLUG;
  }

  const profileMatch = pathOnly.match(/^\/(?:u|p)\/([^/]+)/i);
  if (!profileMatch?.[1]) return "";

  try {
    return decodeURIComponent(profileMatch[1]).trim().toLowerCase();
  } catch {
    return String(profileMatch[1]).trim().toLowerCase();
  }
}

/**
 * Public profile renderer selector.
 *
 * JW Stone keeps its current 2.0 visual experience while remaining a real
 * TradeScout profile with profile-owned routes, identity, discovery, and
 * Direct Connect. Every other profile continues through the shared renderer.
 */
export default function ProfileSiteView() {
  const [location] = useLocation();
  const profileSlug = resolveRequestedProfileSlug(location);

  return (
    <Suspense fallback={<PageLoadingSpinner message="Loading profile..." />}>
      {profileSlug === JW_STONE_PROFILE_SLUG ? (
        <JWStoneProfile />
      ) : (
        <StandardProfileSiteView />
      )}
    </Suspense>
  );
}
