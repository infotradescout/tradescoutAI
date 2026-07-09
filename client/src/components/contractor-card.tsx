import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  MapPin,
  Calendar,
  Clock,
  MessageSquare,
  CheckCircle,
  Shield,
  ExternalLink,
  Users,
  ArrowRight,
} from "lucide-react";
import type { Contractor } from "@shared/schema";

type ContractorCardContractor = Contractor & {
  serviceAreas?: string[];
  canonicalBusinessProfileUrl?: string | null;
};

interface ContractorCardProps {
  contractor: ContractorCardContractor;
  showCallToAction?: boolean;
  compact?: boolean;
  requestOnly?: boolean;
}

export default function ContractorCard({
  contractor,
  showCallToAction = true,
  compact = false,
  requestOnly = false,
}: ContractorCardProps) {
  // Generate company initials for avatar
  const companyInitials =
    contractor.companyName
      ?.split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CC";

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
      : locationSummary || "Local service area pending";
  const yearsInBusinessLabel = contractor.yearsInBusiness
    ? `${contractor.yearsInBusiness} years`
    : "Profile age pending";
  const responseTimeLabel = contractor.responseTimeSla
    ? `${contractor.responseTimeSla} hrs response`
    : "Response signal pending";
  const recommendationLabel =
    (contractor.totalRecommendations || 0) > 0
      ? `${contractor.totalRecommendations} recommendations`
      : "Recommendations pending";
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
  const cvsLabel = cvsScore !== null ? `CVS ${Math.round(cvsScore)}` : "CVS calculating";
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

  return (
    <Card
      className="group overflow-hidden border-white/10 bg-[color:var(--surface-card)] shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:border-ts-orange/40"
      data-testid={`contractor-card`}
    >
      <div className="relative h-20 overflow-hidden border-b border-white/10 bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_10%,rgba(255,107,0,0.28),transparent_34%),linear-gradient(135deg,rgba(255,107,0,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.72))]" />
        <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/58">
          <Shield className="h-3.5 w-3.5 text-ts-orange" />
          TradeScout profile
        </div>
      </div>
      <CardContent className={`${compact ? "p-4" : "p-4 md:p-5"}`}>
        {/* Company Avatar + Trust */}
        <div className="-mt-12 mb-4 flex items-end justify-between gap-3">
          <div
            className={`${
              compact ? "h-14 w-14 text-lg" : "h-20 w-20 text-xl"
            } flex shrink-0 items-center justify-center rounded-full border-2 border-ts-orange bg-black font-bold text-white shadow-lg shadow-black/40`}
          >
            {companyInitials}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center space-x-1">
              <ThumbsUp className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-green-400`} />
              <span className={`text-green-400 font-medium ${compact ? "text-xs" : "text-sm"}`}>
                {contractor.positiveRecommendations || 0}
              </span>
            </div>
            {(contractor.negativeRecommendations || 0) > 0 && (
              <div className="flex items-center space-x-1">
                <ThumbsDown className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-red-400`} />
                <span className={`text-red-400 font-medium ${compact ? "text-xs" : "text-sm"}`}>
                  {contractor.negativeRecommendations}
                </span>
              </div>
            )}
            <span
              className={`text-white/70 ${compact ? "text-xs" : "text-sm"}`}
              data-testid="recommendation-count"
            >
              {contractor.totalRecommendations || 0} total
            </span>
            {connectionRecommendationCount !== null && (
              <span
                className={`flex items-center gap-1 text-blue-300 ${compact ? "text-xs" : "text-sm"}`}
              >
                <Users className={`${compact ? "h-3 w-3" : "h-4 w-4"}`} />
                {connectionRecommendationCount} from your connections
              </span>
            )}
          </div>
        </div>

        {/* Company Name */}
        <Link href={profileHref}>
          <h3
            className={`mb-2 cursor-pointer font-semibold text-white transition-colors hover:text-ts-orange ${
              compact ? "text-base" : "text-lg"
            }`}
          >
            {contractor.companyName}
          </h3>
        </Link>

        {/* Trade Badges (derived from contractor flags) */}
        <div className="flex flex-wrap gap-2 mb-3">
          {contractor.isGeneralContractor && (
            <Badge
              variant="outline"
              className="text-xs ts-accent-text"
              style={{
                backgroundColor:
                  "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)",
                border:
                  "1px solid color-mix(in oklab, var(--theme-accent-primary) 30%, transparent)",
              }}
            >
              General contractor
            </Badge>
          )}
          {contractor.isResidentialContractor && (
            <Badge
              variant="outline"
              className="text-xs ts-accent-text"
              style={{
                backgroundColor:
                  "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)",
                border:
                  "1px solid color-mix(in oklab, var(--theme-accent-primary) 30%, transparent)",
              }}
            >
              Residential
            </Badge>
          )}
        </div>

        {/* Service Areas */}
        <p className={`mb-4 flex items-center text-white/70 ${compact ? "text-xs" : "text-sm"}`}>
          <MapPin
            className={`${compact ? "h-3 w-3" : "h-4 w-4"} mr-1`}
            style={{ color: "var(--theme-accent-primary)" }}
          />
          {serviceAreaLabel}
        </p>

        {/* Business Info */}
        <div
          className={`mb-4 grid grid-cols-3 gap-2 text-white/70 ${compact ? "text-xs" : "text-sm"}`}
        >
          <span className="min-w-0 rounded-[var(--ts-radius-control)] border border-white/10 bg-white/[0.045] p-2">
            <Calendar
              className={`${compact ? "h-3 w-3" : "h-4 w-4"} mb-1`}
              style={{ color: "var(--theme-accent-primary)" }}
            />
            <span className="block truncate">{yearsInBusinessLabel}</span>
          </span>
          <span className="min-w-0 rounded-[var(--ts-radius-control)] border border-white/10 bg-white/[0.045] p-2">
            <Clock
              className={`${compact ? "h-3 w-3" : "h-4 w-4"} mb-1`}
              style={{ color: "var(--theme-accent-primary)" }}
            />
            <span className="block truncate">{responseTimeLabel}</span>
          </span>
          <span className="min-w-0 rounded-[var(--ts-radius-control)] border border-white/10 bg-white/[0.045] p-2">
            <ThumbsUp
              className={`${compact ? "h-3 w-3" : "h-4 w-4"} mb-1`}
              style={{ color: "var(--theme-accent-primary)" }}
            />
            <span className="block truncate">{recommendationLabel}</span>
          </span>
        </div>

        {/* Verification Badges */}
        <div className="flex items-center space-x-2 mb-4">
          <Badge
            variant="outline"
            className="text-xs text-white border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
          >
            {cvsLabel}
          </Badge>
          {contractor.verifiedLicensed && (
            <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Licensed
            </Badge>
          )}
          {contractor.verifiedInsured && (
            <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Insured
            </Badge>
          )}
          {contractor.lastVerified && (
            <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs">
              Verified {new Date(contractor.lastVerified).getFullYear()}
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        {showCallToAction ? (
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/direct-connect?intent=hire&contractor=${encodeURIComponent(contractor.slug)}`}
              className={requestOnly ? "col-span-2" : ""}
            >
              <Button className="w-full ts-accent-btn transition-all duration-300">
                <MessageSquare className="h-4 w-4 mr-1" />
                {requestOnly ? "Request Quote" : "Start a Request"}
              </Button>
            </Link>

            <Link href={profileHref} className={requestOnly ? "col-span-2" : ""}>
              <Button
                variant="outline"
                className="w-full border-white/10 text-white hover:bg-white/10"
              >
                View Profile
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          <Link href={profileHref}>
            <Button
              variant="outline"
              className="w-full border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white"
            >
              View Full Profile
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
