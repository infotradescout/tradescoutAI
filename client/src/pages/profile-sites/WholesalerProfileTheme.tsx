import type { ComponentProps } from "react";
import { JW_STONE_PROFILE_SLUG } from "@shared/jwStonePresentation";
import JWStoneMarketplace from "@/features/jw-stone/JWStoneMarketplace";
import { JwStoneProfileProvider } from "@/features/jw-stone/JwStoneProfileContext";
import LegacyWholesalerProfileTheme from "./WholesalerProfileThemeLegacy";

export type { WholesalerBrandColors } from "./WholesalerProfileThemeLegacy";

type WholesalerProfileThemeProps = ComponentProps<typeof LegacyWholesalerProfileTheme>;

/**
 * TradePartner profiles may own a completely custom presentation while still
 * remaining profiles. JW Stone 2.0 uses its current 2.0 visual experience;
 * every other TradePartner continues through the established wholesale theme.
 */
export default function WholesalerProfileTheme(props: WholesalerProfileThemeProps) {
  if (props.profileSlug.trim().toLowerCase() === JW_STONE_PROFILE_SLUG) {
    return (
      <JwStoneProfileProvider
        profileActions={props.trustActions}
        profileCanonicalUrl={props.profileShareDestination}
      >
        <JWStoneMarketplace />
      </JwStoneProfileProvider>
    );
  }

  return <LegacyWholesalerProfileTheme {...props} />;
}
