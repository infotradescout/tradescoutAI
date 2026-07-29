/**
 * ScoutingReport Component
 *
 * Displays a scouting report with multi-source intelligence.
 * This is NOT a chat message - it's an active intelligence report.
 */

import React from "react";
import clsx from "clsx";

export interface ScoutingFinding {
  source: "knowledge" | "local" | "web";
  title: string;
  items: string[];
  confidence?: "high" | "medium" | "low";
}

export interface ScoutingReportData {
  mission: string;
  date: string;
  jurisdiction?: string;
  findings: ScoutingFinding[];
  synthesis: string;
  confidence: "high" | "medium" | "low";
  nextSteps: string[];
  disclaimers?: string[];
}

interface ScoutingReportProps {
  report: ScoutingReportData;
  onScoutAgain?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onClarify?: () => void;
}

const sourceConfig = {
  knowledge: {
    label: "TradeScout Knowledge Base",
    icon: "📚",
    color: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-800",
    description: "Verified from our database",
  },
  local: {
    label: "Local Jurisdiction Data",
    icon: "📍",
    color: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-800",
    description: "Regional rules and local data",
  },
  web: {
    label: "Live Web Search",
    icon: "🌐",
    color: "bg-orange-50 border-orange-200",
    badge: "bg-orange-100 text-orange-800",
    description: "Current market and web sources",
  },
};

const confidenceConfig = {
  high: {
    label: "HIGH",
    icon: "✓",
    color: "text-green-600",
    bg: "bg-green-50",
    description: "All sources aligned. Data is verified.",
  },
  medium: {
    label: "MEDIUM",
    icon: "⚠️",
    color: "text-orange-600",
    bg: "bg-orange-50",
    description: "Some sources available, but gaps exist.",
  },
  low: {
    label: "LOW",
    icon: "⚠️⚠️",
    color: "text-red-600",
    bg: "bg-red-50",
    description: "Limited data available.",
  },
};

export function ScoutingReport({
  report,
  onScoutAgain,
  onSave,
  onShare,
  onClarify,
}: ScoutingReportProps) {
  return (
    <article className="w-full max-w-4xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">📋</span>
          <h2 className="text-lg font-bold">SCOUTING REPORT</h2>
        </div>
        <div className="text-sm text-blue-100 space-y-1">
          <p>Mission: {report.mission}</p>
          {report.jurisdiction && <p>Jurisdiction: {report.jurisdiction}</p>}
          <p>Date: {report.date}</p>
        </div>
      </div>

      {/* Findings */}
      <div className="px-6 py-6 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>✓</span>
          FINDINGS
        </h3>

        <div className="space-y-4">
          {report.findings.map((finding, idx) => {
            const config = sourceConfig[finding.source];
            return (
              <div key={idx} className={clsx("p-4 rounded-lg border-2", config.color)}>
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-2xl">{config.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{config.label}</h4>
                    <p className="text-sm text-gray-600">{config.description}</p>
                  </div>
                  {finding.confidence && (
                    <span className={clsx("px-2 py-1 rounded text-xs font-semibold", config.badge)}>
                      {finding.confidence.toUpperCase()}
                    </span>
                  )}
                </div>

                <ul className="ml-11 space-y-1">
                  {finding.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Synthesis */}
      <div className="px-6 py-6 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span>✓</span>
          SYNTHESIS
        </h3>
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{report.synthesis}</p>
      </div>

      {/* Next Steps */}
      <div className="px-6 py-6 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span>→</span>
          NEXT STEPS
        </h3>
        <ol className="space-y-2 ml-6 list-decimal">
          {report.nextSteps.map((step, idx) => (
            <li key={idx} className="text-gray-700">
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Confidence & Disclaimers */}
      <div className="px-6 py-6 border-b border-gray-200">
        <div className={clsx("p-4 rounded-lg mb-4", confidenceConfig[report.confidence].bg)}>
          <div className="flex items-start gap-2">
            <span className="text-xl">{confidenceConfig[report.confidence].icon}</span>
            <div className="flex-1">
              <p className={clsx("font-bold", confidenceConfig[report.confidence].color)}>
                Confidence: {confidenceConfig[report.confidence].label}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                {confidenceConfig[report.confidence].description}
              </p>
            </div>
          </div>
        </div>

        {report.disclaimers && report.disclaimers.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Disclaimers</p>
            <ul className="space-y-1">
              {report.disclaimers.map((disclaimer, idx) => (
                <li key={idx} className="text-sm text-yellow-800">
                  • {disclaimer}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50 flex flex-wrap gap-2">
        {onScoutAgain && (
          <button
            onClick={onScoutAgain}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
          >
            🔄 Scout Again
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium text-sm transition-colors"
          >
            📥 Save Report
          </button>
        )}
        {onShare && (
          <button
            onClick={onShare}
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium text-sm transition-colors"
          >
            📤 Share
          </button>
        )}
        {onClarify && (
          <button
            onClick={onClarify}
            className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium text-sm transition-colors"
          >
            ❓ Clarify
          </button>
        )}
      </div>
    </article>
  );
}

// Example usage
export function ScoutingReportExample() {
  const exampleReport: ScoutingReportData = {
    mission: "Building codes for residential deck construction in Austin, TX",
    date: "May 7, 2026",
    jurisdiction: "Travis County, Texas",
    findings: [
      {
        source: "knowledge",
        title: "TradeScout Knowledge Base",
        items: [
          "Deck permits required if height > 30 inches",
          "Deck permits required if area > 200 square feet",
          "Electrical work requires licensed electrician",
        ],
        confidence: "high",
      },
      {
        source: "local",
        title: "Local Jurisdiction Data",
        items: [
          "Austin requires electrical inspection for decks with power",
          "Permit office: Austin Building Services",
          "Typical permit time: 5-7 business days",
        ],
        confidence: "high",
      },
      {
        source: "web",
        title: "Live Web Search",
        items: [
          "2026 Texas Building Code: Railing height must be 42 inches",
          "Average deck cost: $5,000-$15,000",
          "Material prices up 3% from last quarter",
        ],
        confidence: "medium",
      },
    ],
    synthesis:
      "To build a deck in Austin:\n" +
      "1. Measure your proposed deck (height, area)\n" +
      "2. Contact Austin Building Services to determine if a permit is required\n" +
      "3. If permitted, hire a licensed contractor\n" +
      "4. Schedule required inspections before and after construction\n" +
      "5. Ensure railings meet 42-inch height requirement",
    confidence: "high",
    nextSteps: [
      "Measure your proposed deck dimensions",
      "Contact Austin Building Services for permit requirements",
      "Get quotes from licensed contractors",
      "Schedule inspections",
    ],
    disclaimers: [
      "Always verify with your local building department before starting work",
      "Building codes change - confirm current requirements",
      "This is general guidance; specific situations may vary",
    ],
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <ScoutingReport report={exampleReport} />
    </div>
  );
}
