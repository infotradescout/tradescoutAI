import { lazy, Suspense, useEffect, type ComponentProps } from "react";
import { ISSA_BUILD_PROFILE_SLUG } from "@shared/issaBuildProfile";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import { RED_GRANITI_PROFILE_SLUG } from "@shared/redGranitiProfile";
import IssaBuildProfileTruthFrame from "./IssaBuildProfileTruthFrame";
import RedGranitiWebsiteProfile from "./RedGranitiWebsiteProfile";
import LegacyWholesalerProfileTheme from "./WholesalerProfileThemeLegacy";

const JwStoneMarketplaceProfile = lazy(() => import("./JwStoneMarketplaceProfile"));

export type { WholesalerBrandColors } from "./WholesalerProfileThemeLegacy";

type WholesalerProfileThemeProps = ComponentProps<typeof LegacyWholesalerProfileTheme>;

/**
 * TradePartner profiles may own a completely custom presentation while still
 * remaining profiles. JW Stone 2.0 and R.E.D. Graniti use their dedicated
 * profile experiences. ISSA Build keeps its established luxury presentation
 * behind a verified full-service truth and request layer. Every other
 * TradePartner continues through the established wholesale theme.
 */
export default function WholesalerProfileTheme(props: WholesalerProfileThemeProps) {
  const normalizedSlug = props.profileSlug.trim().toLowerCase();
  const isIssaBuildProfile = normalizedSlug === ISSA_BUILD_PROFILE_SLUG;
  const isJwStoneProfile = normalizedSlug === JW_STONE_PROFILE_SLUG;
  const isRedGranitiProfile = normalizedSlug === RED_GRANITI_PROFILE_SLUG;

  useEffect(() => {
    if (!isJwStoneProfile) return;
    return () => {
      document.documentElement.classList.remove("jw-marketplace-scroll");
      document.body.classList.remove("jw-marketplace-scroll");
    };
  }, [isJwStoneProfile]);

  if (isJwStoneProfile) {
    return (
      <Suspense
        fallback={
          <div aria-label="Loading JW Stone inventory" className="min-h-screen bg-[#f7f4ec]" />
        }
      >
        <JwStoneMarketplaceProfile
          profileActions={props.trustActions}
          profileCanonicalUrl={props.profileShareDestination}
        />
      </Suspense>
    );
  }

  if (isRedGranitiProfile) {
    return (
      <RedGranitiWebsiteProfile
        profileSlug={props.profileSlug}
        platformBaseHref={props.platformBaseHref}
      />
    );
  }

  if (isIssaBuildProfile) {
    return <IssaBuildProfileTruthFrame {...props} />;
  }

  return <LegacyWholesalerProfileTheme {...props} />;
}
