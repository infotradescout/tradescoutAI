import { useMemo, useState, type ComponentProps } from "react";
import { ShieldCheck } from "lucide-react";
import ExpressDirectConnectPanel from "./ExpressDirectConnectPanel";
import LegacyWholesalerProfileTheme from "./WholesalerProfileThemeLegacy";
import { ISSA_BUILD_LOCAL_DISCOVERY } from "@shared/issaBuildProfile";
import { pensacolaProjectMessage } from "@shared/pensacolaDiscovery";

type Props = ComponentProps<typeof LegacyWholesalerProfileTheme>;
type ContentBlock = Props["contentBlocks"][number];
type UnknownRecord = Record<string, unknown>;

const ISSA_BUILD_VERIFICATION_LABEL = "100% Verified by TradeScout";
const ISSA_BUILD_FULL_SERVICE_SCOPE = [
  "Material selection",
  "Material sourcing and availability",
  "Custom onyx fabrication",
  "Backlighting design and installation",
  "Custom onyx installation",
  "Residential and commercial projects",
  "Project fulfillment",
] as const;

function recordValue(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

/**
 * The profile provisioner already stores ISSA Build's verified operating truth.
 * This presentation adapter keeps that truth visible even though the luxury
 * profile uses its canonical design payload rather than the stored JSON blocks.
 */
function applyIssaBuildPublicTruth(contentBlocks: Props["contentBlocks"]): Props["contentBlocks"] {
  return contentBlocks.map((block) => {
    const data = recordValue(block.data);

    if (block.type === "hero") {
      return {
        ...block,
        data: {
          ...data,
          eyebrow: "PENSACOLA AND SURROUNDING AREAS",
          headerLabel: "Kitchens, bathrooms and stone.",
          teaser: ISSA_BUILD_LOCAL_DISCOVERY.description,
        },
      } as ContentBlock;
    }

    if (block.type === "about") {
      return {
        ...block,
        data: {
          ...data,
          text: "ISSA Build handles Pensacola-area kitchens, bathrooms, cabinets, stone countertops and fabrication. TradeScout manages every inquiry. ISSA Build also handles material sourcing and availability, selection, custom onyx fabrication, backlighting design and installation, custom onyx installation, and residential and commercial project fulfillment.",
        },
      } as ContentBlock;
    }

    if (block.type === "trust") {
      return {
        ...block,
        data: {
          ...data,
          items: [
            ISSA_BUILD_VERIFICATION_LABEL,
            "Verified full-service scope: sourcing, selection, fabrication, backlighting, installation, and fulfillment",
          ],
        },
      } as ContentBlock;
    }

    if (block.type === "premiumProduct") {
      const luxuryHouse = recordValue(data.luxuryHouse);
      return {
        ...block,
        data: {
          ...data,
          luxuryHouse: {
            ...luxuryHouse,
            designedWithLight: {
              ...recordValue(luxuryHouse.designedWithLight),
              body: "ISSA Build takes the project from material sourcing, availability, and selection through custom onyx fabrication, backlighting design, installation, and final project fulfillment.",
            },
            capabilities: {
              ...recordValue(luxuryHouse.capabilities),
              title: "Kitchens, bathrooms and complete onyx projects.",
              body: "ISSA Build handles kitchens, bathrooms, cabinets, countertops and fabrication in Pensacola and surrounding areas, alongside its full-service onyx work.",
              items: [
                ...ISSA_BUILD_LOCAL_DISCOVERY.services.map((service) => ({
                  title: service.title,
                  body: service.description,
                })),
                ...ISSA_BUILD_FULL_SERVICE_SCOPE.map((title) => ({ title, body: "" })),
              ],
            },
            consultation: {
              ...recordValue(luxuryHouse.consultation),
              title: "Start a Request.",
              body: "Tell TradeScout about your kitchen, bathroom, cabinets, countertops or fabrication. Include your actual city or ZIP, dimensions and timing. TradeScout manages the inquiry for ISSA Build.",
            },
          },
        },
      } as ContentBlock;
    }

    if (block.type === "cta") {
      return {
        ...block,
        data: {
          ...data,
          heading: "Start a Request",
          description:
            "Tell TradeScout about your kitchen, bathroom, cabinets, countertops or fabrication, including your actual project city or ZIP. ISSA Build handles the work.",
        },
      } as ContentBlock;
    }

    return block;
  });
}

export default function IssaBuildProfileTruthFrame(props: Props) {
  const [requestOpen, setRequestOpen] = useState(false);
  const verifiedContentBlocks = useMemo(
    () => applyIssaBuildPublicTruth(props.contentBlocks),
    [props.contentBlocks]
  );

  return (
    <div data-testid="issa-build-verified-profile-frame">
      <LegacyWholesalerProfileTheme
        {...props}
        contentBlocks={verifiedContentBlocks}
        trustActions={
          <>
            <span
              data-testid="issa-build-verification-status"
              className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-200"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              {ISSA_BUILD_VERIFICATION_LABEL}
            </span>
            {props.trustActions}
          </>
        }
        onProjectRequest={() => setRequestOpen(true)}
      />

      <ExpressDirectConnectPanel
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        profileSlug={props.profileSlug}
        platformBaseHref={props.platformBaseHref}
        businessName={props.displayName}
        businessAddress={props.businessAddress}
        hasViewerSession={props.hasViewerSession}
        allowCall={props.allowExpressCall}
        requestMode="service"
        initialServiceName="Kitchen and bathroom project"
        initialMessage={pensacolaProjectMessage("project")}
        initialView="request"
        initialRequestType="request_quote"
        stayInProfile
      />
    </div>
  );
}
