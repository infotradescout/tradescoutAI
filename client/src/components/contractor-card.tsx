import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, MapPin, MessageSquare, CheckCircle, Shield, Users } from "lucide-react";
import type { Contractor } from "@shared/schema";

export type ProviderCardProvider = Omit<Partial<Contractor>, "id" | "slug"> & {
  id: string;
  slug?: string | null;
  serviceAreas?: string[];
  canonicalBusinessProfileUrl?: string | null;
  name?: string | null;
  category?: string | null;
  roleContext?: string | null;
  description?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  county?: string | null;
  countyName?: string | null;
  connectionRecommendationCount?: number | null;
  trustScore?: number | string | null;
  cvsScore?: number | string | null;
  contentBlocks?: Array<{ type?: string; data?: Record<string, any> }>;
  seoMeta?: { imageUrl?: string | null; faviconUrl?: string | null } | null;
};

export interface ProviderCardProps {
  contractor: ProviderCardProvider;
  compact?: boolean;
  action?: "connect" | "profile" | "none";
}

export function ProviderCard({
  contractor,
  compact = false,
  action = "connect",
}: ProviderCardProps) {
  const businessName = String(contractor.companyName || contractor.name || "Business").trim();
  const companyInitials =
    businessName
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "B";

  const serviceAreas = contractor.serviceAreas || [];
  const city = String(contractor.city || "").trim();
  const stateCode = String(contractor.state || contractor.stateCode || "").trim();
  const county = String(contractor.county || contractor.countyName || "").trim();
  const locationSummary = [city, stateCode].filter(Boolean).join(", ") || county;
  const serviceAreaLabel =
    serviceAreas.length > 0
      ? `${serviceAreas.slice(0, 2).join(", ")}${
          serviceAreas.length > 2 ? ` +${serviceAreas.length - 2} more` : ""
        }`
      : locationSummary;
  const connectionRecommendationCountRaw = contractor.connectionRecommendationCount;
  const connectionRecommendationCount =
    typeof connectionRecommendationCountRaw === "number" &&
    Number.isFinite(connectionRecommendationCountRaw)
      ? Math.max(0, Math.trunc(connectionRecommendationCountRaw))
      : null;
  const profileSlug = String(contractor.slug || "").trim();
  const canonicalProfileHref =
    typeof contractor.canonicalBusinessProfileUrl === "string" &&
    contractor.canonicalBusinessProfileUrl.trim().length > 0
      ? contractor.canonicalBusinessProfileUrl.trim()
      : null;
  const profileHref =
    canonicalProfileHref || (profileSlug ? `/business/${encodeURIComponent(profileSlug)}` : null);
  const profileBlocks = Array.isArray(contractor.contentBlocks) ? contractor.contentBlocks : [];
  const heroBlock = profileBlocks.find((block) => block?.type === "hero")?.data || {};
  const galleryBlock = profileBlocks.find((block) => block?.type === "gallery")?.data || {};
  const galleryImages = Array.isArray(galleryBlock.images) ? galleryBlock.images : [];
  const photos = Array.isArray(contractor.photos) ? contractor.photos : [];
  const previewImage = [
    heroBlock.imageUrl,
    heroBlock.backgroundImageUrl,
    contractor.seoMeta?.imageUrl,
    photos[0],
    typeof galleryImages[0] === "string" ? galleryImages[0] : galleryImages[0]?.url,
  ].find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const categoryLabel = String(
    contractor.category ||
      contractor.roleContext ||
      (contractor.isGeneralContractor ? "General contractor" : "")
  ).trim();
  const description = String(contractor.description || contractor.about || "").trim();
  const trustFacts = [
    contractor.verifiedLicensed ? { label: "Licensed", Icon: CheckCircle } : null,
    contractor.verifiedInsured ? { label: "Insured", Icon: Shield } : null,
    (contractor.totalRecommendations || 0) > 0
      ? { label: `${contractor.totalRecommendations} recommendations`, Icon: Users }
      : null,
  ].filter(Boolean) as Array<{ label: string; Icon: typeof Shield }>;
  const connectParams = new URLSearchParams({
    intent: "hire",
    targetProviderId: String(contractor.id),
    targetName: businessName,
  });
  if (profileSlug) connectParams.set("contractor", profileSlug);
  const connectHref = `/direct-connect?${connectParams.toString()}`;
  const actionHref = action === "connect" ? connectHref : profileHref;
  const showAction = action !== "none" && Boolean(actionHref);

  const title = (
    <h3
      className={`${compact ? "text-base sm:text-lg" : "text-xl"} line-clamp-2 font-semibold leading-tight text-[color:var(--text-primary)]`}
    >
      {businessName}
    </h3>
  );

  return (
    <Card
      className="group h-full overflow-hidden border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] transition hover:border-[color:var(--theme-accent-primary)]/50 hover:shadow-xl"
      data-testid="contractor-card"
    >
      <div
        className={
          compact
            ? "grid min-h-[11rem] grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[8rem_minmax(0,1fr)]"
            : undefined
        }
      >
        <div
          className={
            compact
              ? "relative min-h-full overflow-hidden bg-[color:var(--surface-intermediate)]"
              : "relative aspect-[16/8] overflow-hidden bg-[color:var(--surface-intermediate)]"
          }
        >
          {previewImage ? (
            <img
              src={previewImage}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full min-h-[8rem] items-center justify-center text-2xl font-bold text-white/80">
              {companyInitials}
            </div>
          )}
        </div>
        <CardContent className={`${compact ? "flex min-w-0 flex-col p-3.5 sm:p-4" : "p-5"}`}>
          {categoryLabel && (
            <p className="mb-1.5 line-clamp-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--theme-accent-primary)]">
              {categoryLabel.replace(/_/g, " ")}
            </p>
          )}
          {profileHref ? (
            <Link
              href={profileHref}
              className="rounded-sm outline-none hover:text-[color:var(--theme-accent-primary)] focus-visible:ring-2 focus-visible:ring-[color:var(--theme-accent-primary)]"
              aria-label={`View ${businessName} profile`}
            >
              {title}
            </Link>
          ) : (
            title
          )}
          {serviceAreaLabel && (
            <p className="mt-1.5 flex min-w-0 items-center text-xs text-[color:var(--text-secondary)]">
              <MapPin className="mr-1.5 h-3.5 w-3.5 shrink-0 text-[color:var(--theme-accent-primary)]" />
              <span className="truncate">{serviceAreaLabel}</span>
            </p>
          )}
          {description && (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--text-secondary)]">
              {description}
            </p>
          )}
          {(trustFacts.length > 0 || connectionRecommendationCount !== null) && (
            <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-[color:var(--text-secondary)]">
              {trustFacts.map(({ label, Icon }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-[color:var(--theme-accent-primary)]" />
                  {label}
                </span>
              ))}
              {connectionRecommendationCount !== null && connectionRecommendationCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[color:var(--theme-accent-primary)]" />
                  {connectionRecommendationCount} from your connections
                </span>
              )}
            </div>
          )}
          {showAction && actionHref ? (
            <div className="mt-auto pt-3">
              <Button
                asChild
                size={compact ? "sm" : "default"}
                variant={action === "connect" ? "default" : "outline"}
                className={
                  action === "connect"
                    ? "w-full ts-accent-btn transition-all duration-300"
                    : "w-full border-[color:var(--border-subtle)]"
                }
              >
                <Link href={actionHref}>
                  {action === "connect" ? (
                    <MessageSquare className="mr-1 h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="mr-1 h-4 w-4" />
                  )}
                  {action === "connect" ? "Connect" : "View profile"}
                </Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </div>
    </Card>
  );
}

// Compatibility default: existing imports keep working while new surfaces use ProviderCard.
export default ProviderCard;
