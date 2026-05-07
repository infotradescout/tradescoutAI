/**
 * Scout Source Attribution Component
 *
 * Displays source information, confidence levels, and trust signals
 * for Scout answers. Ensures transparency about data sources and accuracy.
 *
 * Design: Dark mode, mobile-first, clear hierarchy
 */

import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, Globe, Database } from "lucide-react";

export interface SourceAttributionProps {
  sources: string[];
  confidence: "high" | "medium" | "low";
  lastUpdated?: string;
  includesWebSearch?: boolean;
  disclaimers?: string[];
}

/**
 * Source Attribution Component
 * Displays where the answer came from and how confident Scout is
 */
export function ScoutSourceAttribution({
  sources,
  confidence,
  lastUpdated,
  includesWebSearch,
  disclaimers,
}: SourceAttributionProps) {
  const confidenceConfig = {
    high: {
      label: "Verified",
      color: "bg-green-900 text-green-100",
      icon: CheckCircle2,
      description: "Based on verified TradeScout data",
    },
    medium: {
      label: "Reliable",
      color: "bg-blue-900 text-blue-100",
      icon: Database,
      description: "Combination of local and web data",
    },
    low: {
      label: "Limited Data",
      color: "bg-amber-900 text-amber-100",
      icon: AlertCircle,
      description: "Limited information available",
    },
  };

  const config = confidenceConfig[confidence];
  const ConfidenceIcon = config.icon;

  return (
    <div className="mt-4 space-y-3 text-xs">
      {/* Confidence Badge */}
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded ${config.color}`}>
          <ConfidenceIcon className="w-3 h-3" />
        </div>
        <div>
          <div className="font-semibold">{config.label}</div>
          <div className="text-gray-400">{config.description}</div>
        </div>
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div className="space-y-2">
          <div className="text-gray-400 font-semibold">Sources:</div>
          <div className="flex flex-wrap gap-2">
            {sources.map((source) => (
              <SourceBadge key={source} source={source} />
            ))}
          </div>
        </div>
      )}

      {/* Web Search Indicator */}
      {includesWebSearch && (
        <div className="flex items-center gap-2 text-gray-400">
          <Globe className="w-3 h-3" />
          <span>Includes real-time web search results</span>
        </div>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-3 h-3" />
          <span>Updated: {formatDate(lastUpdated)}</span>
        </div>
      )}

      {/* Disclaimers */}
      {disclaimers && disclaimers.length > 0 && (
        <div className="space-y-1 bg-amber-900/20 border border-amber-700/30 rounded p-2">
          {disclaimers.map((disclaimer, idx) => (
            <div key={idx} className="text-amber-100 text-xs">
              ⚠️ {disclaimer}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual source badge with icon
 */
function SourceBadge({ source }: { source: string }) {
  const getSourceIcon = (src: string) => {
    if (src.includes("Building Code")) return "📋";
    if (src.includes("Pricing")) return "💰";
    if (src.includes("Trade Guide")) return "🔧";
    if (src.includes("Local")) return "📍";
    if (src.includes("Web")) return "🌐";
    return "📌";
  };

  return (
    <Badge
      variant="outline"
      className="bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700 text-xs"
    >
      <span className="mr-1">{getSourceIcon(source)}</span>
      {source}
    </Badge>
  );
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  } catch {
    return dateString;
  }
}

/**
 * Trust Signal Component
 * Shows verification badges and endorsements
 */
export function ScoutTrustSignals({
  isVerified,
  endorsementCount,
  communityRating,
}: {
  isVerified?: boolean;
  endorsementCount?: number;
  communityRating?: number;
}) {
  return (
    <div className="flex items-center gap-3 text-xs text-gray-400">
      {isVerified && (
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span>Verified</span>
        </div>
      )}
      {endorsementCount && endorsementCount > 0 && (
        <div className="flex items-center gap-1">
          <span>👍 {endorsementCount} endorsements</span>
        </div>
      )}
      {communityRating && (
        <div className="flex items-center gap-1">
          <span>⭐ {communityRating.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Answer Card with integrated source attribution
 * Use this to wrap Scout answers with trust signals
 */
export function ScoutAnswerCard({
  children,
  sources,
  confidence,
  lastUpdated,
  includesWebSearch,
  disclaimers,
}: {
  children: React.ReactNode;
  sources: string[];
  confidence: "high" | "medium" | "low";
  lastUpdated?: string;
  includesWebSearch?: boolean;
  disclaimers?: string[];
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      {/* Main answer */}
      <div className="text-gray-100">{children}</div>

      {/* Source attribution */}
      <div className="border-t border-gray-800 pt-3">
        <ScoutSourceAttribution
          sources={sources}
          confidence={confidence}
          lastUpdated={lastUpdated}
          includesWebSearch={includesWebSearch}
          disclaimers={disclaimers}
        />
      </div>
    </div>
  );
}
