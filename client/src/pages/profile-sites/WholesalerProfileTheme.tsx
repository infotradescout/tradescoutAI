import { useEffect, type ComponentProps } from "react";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import { RED_GRANITI_PROFILE_SLUG } from "@shared/redGranitiProfile";
import JWStoneMarketplace from "@/features/jw-stone/JWStoneMarketplace";
import { JwStoneProfileProvider } from "@/features/jw-stone/JwStoneProfileContext";
import { JwStoneProfileSeo } from "@/features/jw-stone/JwStoneProfileSeo";
import { PublicProfileAccountCard } from "@/components/profile/PublicProfileAccountCard";
import RedGranitiProfileTheme from "./RedGranitiProfileTheme";
import LegacyWholesalerProfileTheme from "./WholesalerProfileThemeLegacy";

export type { WholesalerBrandColors } from "./WholesalerProfileThemeLegacy";

type WholesalerProfileThemeProps = ComponentProps<typeof LegacyWholesalerProfileTheme>;

/**
 * TradePartner profiles may own a completely custom presentation while still
 * remaining profiles. JW Stone 2.0 and R.E.D. Graniti use their dedicated
 * profile experiences; every other TradePartner continues through the
 * established wholesale theme.
 */
export default function WholesalerProfileTheme(props: WholesalerProfileThemeProps) {
  const normalizedSlug = props.profileSlug.trim().toLowerCase();
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
      <JwStoneProfileProvider
        profileActions={
          <>
            {props.trustActions}
            <PublicProfileAccountCard
              profileSlug={JW_STONE_PROFILE_SLUG}
              profileName="JW Stone"
              tone="light"
              compact
              className="mt-5"
            />
          </>
        }
        profileCanonicalUrl={props.profileShareDestination}
      >
        <JWStoneMarketplace />
        <JwStoneProfileSeo canonical={props.profileShareDestination} />
      </JwStoneProfileProvider>
    );
  }

  if (isRedGranitiProfile) {
    return (
      <RedGranitiProfileTheme
        profileSlug={props.profileSlug}
        platformBaseHref={props.platformBaseHref}
        profileShareDestination={props.profileShareDestination}
        hasViewerSession={props.hasViewerSession}
        businessAddress={props.businessAddress}
        trustActions={props.trustActions}
        profileItems={props.profileItems}
      />
    );
  }

  return <LegacyWholesalerProfileTheme {...props} />;
}
