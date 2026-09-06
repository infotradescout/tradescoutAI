import { useMemo, useState, type ComponentProps } from "react";
import { CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
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
      <section
        className="border-b border-amber-300/20 bg-stone-950 text-white"
        aria-label="ISSA Build verification and service scope"
        data-testid="issa-build-verification-band"
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {ISSA_BUILD_VERIFICATION_LABEL}
                </span>
                <span className="text-xs font-semibold text-white/65">
                  TradeScout manages every inquiry. ISSA Build handles the work.
                </span>
              </div>
              <ul
                className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label="Verified ISSA Build services"
              >
                {ISSA_BUILD_FULL_SERVICE_SCOPE.map((service) => (
                  <li
                    key={service}
                    className="inline-flex min-h-9 flex-none snap-start items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold text-white/85"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    {service}
                  </li>
                ))}
              </ul>
              <nav
                aria-label="ISSA Build Pensacola services"
                className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-amber-200"
              >
                {ISSA_BUILD_LOCAL_DISCOVERY.services.map((service) => (
                  <a
                    key={service.slug}
                    href={`/u/issa-build/services/${service.slug}`}
                    className="underline underline-offset-4"
                  >
                    {service.title}
                  </a>
                ))}
                <a href="/u/issa-build/service-areas" className="underline underline-offset-4">
                  Pensacola and surrounding areas
                </a>
              </nav>
            </div>
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="inline-flex min-h-12 flex-none items-center justify-center gap-2 rounded-full bg-ts-orange px-6 text-sm font-black text-white shadow-lg shadow-orange-950/30 transition hover:bg-ts-orange-dark"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Start a Request
            </button>
          </div>
        </div>
      </section>

      <LegacyWholesalerProfileTheme
        {...props}
        contentBlocks={verifiedContentBlocks}
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
