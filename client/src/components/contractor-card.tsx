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
} from "lucide-react";
import type { Contractor } from "@shared/schema";

type ContractorCardContractor = Contractor & {
  serviceAreas?: string[];
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

  return (
    <Card className="ts-card" data-testid={`contractor-card`}>
      <CardContent className={`${compact ? "p-4" : "p-3 md:p-6"}`}>
        {/* Company Avatar + Trust */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={`${
              compact ? "w-12 h-12 text-lg" : "w-16 h-16 text-xl"
            } ts-accent-btn rounded-lg flex items-center justify-center font-bold`}
          >
            {companyInitials}
          </div>

          <div className="flex items-center space-x-2">
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
              ({contractor.totalRecommendations || 0} total)
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
        {requestOnly ? (
          <h3
            className={`font-semibold mb-2 text-[color:var(--text-primary)] ${compact ? "text-base" : "text-lg"}`}
          >
            {contractor.companyName}
          </h3>
        ) : (
          <Link href={`/contractors/${contractor.slug}`}>
            <h3
              className={`font-semibold mb-2 transition-colors cursor-pointer text-[color:var(--text-primary)] hover:text-[color:var(--theme-accent-primary)] ${
                compact ? "text-base" : "text-lg"
              }`}
            >
              {contractor.companyName}
            </h3>
          </Link>
        )}

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
        <p className={`text-white/70 mb-4 flex items-center ${compact ? "text-xs" : "text-sm"}`}>
          <MapPin
            className={`${compact ? "h-3 w-3" : "h-4 w-4"} mr-1`}
            style={{ color: "var(--theme-accent-primary)" }}
          />
          {serviceAreas.length > 0
            ? `${serviceAreas.slice(0, 2).join(", ")}${
                serviceAreas.length > 2 ? ` +${serviceAreas.length - 2} more` : ""
              }`
            : "Service area not specified"}
        </p>

        {/* Business Info */}
        <div
          className={`flex items-center justify-between text-white/70 mb-4 ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          <span className="flex items-center">
            <Calendar
              className={`${compact ? "h-3 w-3" : "h-4 w-4"} mr-1`}
              style={{ color: "var(--theme-accent-primary)" }}
            />
            {contractor.yearsInBusiness
              ? `${contractor.yearsInBusiness} years`
              : "Years in business n/a"}
          </span>
          <span className="flex items-center">
            <Clock
              className={`${compact ? "h-3 w-3" : "h-4 w-4"} mr-1`}
              style={{ color: "var(--theme-accent-primary)" }}
            />
            {contractor.responseTimeSla
              ? `${contractor.responseTimeSla} hrs response`
              : "Response time n/a"}
          </span>
          <span className="flex items-center">
            <ThumbsUp
              className={`${compact ? "h-3 w-3" : "h-4 w-4"} mr-1`}
              style={{ color: "var(--theme-accent-primary)" }}
            />
            {contractor.totalRecommendations || 0} recommendations
          </span>
        </div>

        {/* Verification Badges */}
        <div className="flex items-center space-x-2 mb-4">
          <Badge
            variant="outline"
            className="text-xs text-white border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
          >
            {cvsScore !== null ? `CVS ${Math.round(cvsScore)}` : "CVS Pending"}
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
          <div className="flex space-x-2">
            <Link
              href={`/direct-connect?intent=hire&contractor=${encodeURIComponent(contractor.slug)}`}
              className={requestOnly ? "w-full" : "flex-1"}
            >
              <Button className="w-full ts-accent-btn transition-all duration-300">
                <MessageSquare className="h-4 w-4 mr-1" />
                {requestOnly ? "Request Quote" : "Start Direct Connect"}
              </Button>
            </Link>

            {!requestOnly && (
              <Link href={`/contractors/${contractor.slug}`} className="flex-1">
                <Button
                  variant="outline"
                  className="w-full border-white/10 text-white hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Profile
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <Link href={`/contractors/${contractor.slug}`}>
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
