import { useMemo, useState, type ComponentProps } from "react";
import { CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import ExpressDirectConnectPanel from "./ExpressDirectConnectPanel";
import LegacyWholesalerProfileTheme from "./WholesalerProfileThemeLegacy";

type Props = ComponentProps<typeof LegacyWholesalerProfileTheme>;
type ContentBlock = Props["contentBlocks"][number];
type UnknownRecord = Record<string, unknown>;

const ISSA_BUILD_VERIFICATION_LABEL = "100% Verified by TradeScout";
const ISSA_BUILD_FULL_SERVICE_SCOPE = [
  "Material selection",
  "Custom onyx fabrication",
  "Backlighting design and installation",
  "Custom onyx installation",
  "Residential and commercial projects",
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
          teaser:
            "100% verified full-service Honey Onyx and Multi Green Onyx—from material selection and custom fabrication through backlighting and installation.",
        },
      } as ContentBlock;
    }

    if (block.type === "about") {
      return {
        ...block,
        data: {
          ...data,
          text: "TradeScout manages every inquiry. ISSA Build handles material selection, custom onyx fabrication, backlighting design and installation, custom onyx installation, and residential and commercial projects.",
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
            "Verified full-service scope: selection, fabrication, backlighting, and installation",
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
              body: "ISSA Build takes the project from material selection and custom onyx fabrication through backlighting design, installation, and final onyx installation.",
            },
            capabilities: {
              ...recordValue(luxuryHouse.capabilities),
              title: "Complete onyx projects.",
              body: "ISSA Build handles the complete project for residential and commercial interiors.",
              items: ISSA_BUILD_FULL_SERVICE_SCOPE.map((title) => ({ title, body: "" })),
            },
            consultation: {
              ...recordValue(luxuryHouse.consultation),
              title: "Start a Request.",
              body: "Tell TradeScout about the room, material, scale, location, and timing. TradeScout manages the inquiry and ISSA Build handles the complete onyx project.",
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
            "Tell TradeScout about the space, material, scale, location, and timing. ISSA Build handles the complete onyx project.",
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

      <LegacyWholesalerProfileTheme {...props} contentBlocks={verifiedContentBlocks} />

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
        initialView="request"
        initialRequestType="request_quote"
        stayInProfile
      />
    </div>
  );
}
