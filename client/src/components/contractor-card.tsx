import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, MessageSquare, CheckCircle, Shield, Users } from "lucide-react";
import type { Contractor } from "@shared/schema";

export type ProviderCardProvider = Contractor & {
  serviceAreas?: string[];
  canonicalBusinessProfileUrl?: string | null;
  name?: string | null;
  category?: string | null;
  roleContext?: string | null;
  description?: string | null;
  contentBlocks?: Array<{ type?: string; data?: Record<string, any> }>;
  seoMeta?: { imageUrl?: string | null; faviconUrl?: string | null } | null;
};

export interface ProviderCardProps {
  contractor: ProviderCardProvider;
  showCallToAction?: boolean;
  compact?: boolean;
  requestOnly?: boolean;
}

export function ProviderCard({
  contractor,
  showCallToAction = true,
  compact = false,
  requestOnly = false,
}: ProviderCardProps) {
  const [, navigate] = useLocation();
  const businessName = String(contractor.companyName || contractor.name || "Business").trim();
  const companyInitials =
    businessName
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "B";

  const serviceAreas = contractor.serviceAreas || [];
  const city = String((contractor as any).city || "").trim();
  const stateCode = String((contractor as any).state || (contractor as any).stateCode || "").trim();
  const county = String((contractor as any).county || (contractor as any).countyName || "").trim();
  const locationSummary = [city, stateCode].filter(Boolean).join(", ") || county;
  const serviceAreaLabel =
    serviceAreas.length > 0
      ? `${serviceAreas.slice(0, 2).join(", ")}${
          serviceAreas.length > 2 ? ` +${serviceAreas.length - 2} more` : ""
        }`
      : locationSummary;
  const rawCvs =
    typeof (contractor as any).trustScore === "number"
      ? (contractor as any).trustScore
      : typeof (contractor as any).trustScore === "string"
        ? Number((contractor as any).trustScore)
        : typeof (contractor as any).cvsScore === "number"
          ? (contractor as any).cvsScore
          : typeof (contractor as any).cvsScore === "string"
            ? Number((contractor as any).cvsScore)
            : null;
  const cvsScore = Number.isFinite(rawCvs as number) ? Number(rawCvs) : null;
  const connectionRecommendationCountRaw = (contractor as any).connectionRecommendationCount;
  const connectionRecommendationCount =
    typeof connectionRecommendationCountRaw === "number" &&
    Number.isFinite(connectionRecommendationCountRaw)
      ? Math.max(0, Math.trunc(connectionRecommendationCountRaw))
      : null;
  const profileHref =
    typeof contractor.canonicalBusinessProfileUrl === "string" &&
    contractor.canonicalBusinessProfileUrl.trim().length > 0
      ? contractor.canonicalBusinessProfileUrl.trim()
      : `/business/${encodeURIComponent(contractor.slug)}`;
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
    cvsScore !== null ? { label: `CVS ${Math.round(cvsScore)}`, Icon: Shield } : null,
    (contractor.totalRecommendations || 0) > 0
      ? { label: `${contractor.totalRecommendations} recommendations`, Icon: Users }
      : null,
  ].filter(Boolean) as Array<{ label: string; Icon: typeof Shield }>;

  const openProfile = () => navigate(profileHref);

  return (
    <Card
      className="group h-full cursor-pointer overflow-hidden border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] transition hover:-translate-y-0.5 hover:border-[color:var(--theme-accent-primary)]/50 hover:shadow-xl"
      data-testid="contractor-card"
      role="link"
      tabIndex={0}
      aria-label={`View ${businessName} profile`}
      onClick={openProfile}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openProfile();
      }}
    >
      <div className="relative aspect-[16/8] overflow-hidden bg-[color:var(--surface-intermediate)]">
        {previewImage ? (
          <img
            src={previewImage}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-bold text-white/80">
            {companyInitials}
          </div>
        )}
        {categoryLabel && (
          <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {categoryLabel.replace(/_/g, " ")}
          </div>
        )}
      </div>
      <CardContent className={`${compact ? "p-4" : "p-5"}`}>
        <h3
          className={`${compact ? "text-lg" : "text-xl"} font-semibold text-[color:var(--text-primary)]`}
        >
          {businessName}
        </h3>
        {serviceAreaLabel && (
          <p className="mt-1.5 flex items-center text-sm text-[color:var(--text-secondary)]">
            <MapPin className="mr-1.5 h-4 w-4 text-[color:var(--theme-accent-primary)]" />
            {serviceAreaLabel}
          </p>
        )}
        {description && (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[color:var(--text-secondary)]">
            {description}
          </p>
        )}
        {(trustFacts.length > 0 || connectionRecommendationCount !== null) && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[color:var(--text-secondary)]">
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
        {showCallToAction ? (
          <div className="mt-5">
            <Button
              className="w-full ts-accent-btn transition-all duration-300"
              onClick={(event) => {
                event.stopPropagation();
                navigate(
                  `/direct-connect?intent=connect&targetProviderId=${encodeURIComponent(contractor.id)}&targetName=${encodeURIComponent(businessName)}&contractor=${encodeURIComponent(contractor.slug)}`
                );
              }}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Connect
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// Compatibility default: existing imports keep working while new surfaces use ProviderCard.
export default ProviderCard;
