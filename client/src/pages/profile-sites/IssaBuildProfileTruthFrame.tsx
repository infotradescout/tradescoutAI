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

/** Retain service facts without rewriting the existing profile copy. */
function applyIssaBuildPublicTruth(contentBlocks: Props["contentBlocks"]): Props["contentBlocks"] {
  return contentBlocks.map((block) => {
    if (block.type !== "premiumProduct") return block;
    const data = recordValue(block.data);
    const luxuryHouse = recordValue(data.luxuryHouse);
    return {
      ...block,
      data: {
        ...data,
        luxuryHouse: {
          ...luxuryHouse,
          capabilities: {
            ...recordValue(luxuryHouse.capabilities),
            items: [
              ...ISSA_BUILD_LOCAL_DISCOVERY.services.map((service) => ({
                title: service.title,
                body: "",
              })),
              ...ISSA_BUILD_FULL_SERVICE_SCOPE.map((title) => ({ title, body: "" })),
            ],
          },
        },
      },
    } as ContentBlock;
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
