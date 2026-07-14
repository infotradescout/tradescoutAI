import { useState } from "react";
import WholesalerProfileThemeCore, {
  type WholesalerBrandColors,
} from "./WholesalerProfileThemeCore";
import ExpressDirectConnectPanel from "./ExpressDirectConnectPanel";
import ProFabProfileTheme from "./ProFabProfileTheme";

export type { WholesalerBrandColors } from "./WholesalerProfileThemeCore";

type ContentBlock = {
  type: string;
  data?: Record<string, any>;
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
};

type RecommendationEntry = {
  id: string;
  createdAt: string | null;
  recommendationType: "positive" | "negative";
  comment: string;
  projectType: string | null;
  contractor: {
    id: string;
    companyName: string;
    slug: string;
    canonicalBusinessProfileUrl?: string | null;
  };
};

type RecommendationDirectorySummary = {
  total: number;
  positive: number;
  negative: number;
};

type Props = {
  profileSlug: string;
  displayName: string;
  headline: string | null;
  contentBlocks: ContentBlock[];
  categories: string[];
  serviceAreas: string[];
  brandColors?: WholesalerBrandColors;
  contactReason?: string | null;
  hasViewerSession: boolean;
  isSuperAdminViewer: boolean;
  useExpressDirectConnect: boolean;
  directConnectHref: string;
  preScoutCreateHref: string;
  preScoutSignInHref: string;
  recommendationsDirectory?: RecommendationEntry[];
  recommendationDirectorySummary?: RecommendationDirectorySummary;
};

/**
 * Keeps the established shared TradePartner theme intact while allowing a
 * managed business profile to use a business-specific presentation. Public
 * profile routing, SEO, account-aware exit behavior, and Express Direct
 * Connect still remain owned by the canonical /u/:slug profile surface.
 */
export default function WholesalerProfileTheme(props: Props) {
  const [expressPanelOpen, setExpressPanelOpen] = useState(false);

  if (props.profileSlug !== "pro-fab-specialty-services") {
    return <WholesalerProfileThemeCore {...props} />;
  }

  return (
    <>
      <ProFabProfileTheme
        onDirectConnect={() => setExpressPanelOpen(true)}
        hasViewerSession={props.hasViewerSession}
        recommendationsDirectory={props.recommendationsDirectory}
      />
      <ExpressDirectConnectPanel
        open={expressPanelOpen}
        onClose={() => setExpressPanelOpen(false)}
        profileSlug={props.profileSlug}
        businessName={props.displayName}
        hasViewerSession={props.hasViewerSession}
        requestMode="service"
      />
    </>
  );
}
