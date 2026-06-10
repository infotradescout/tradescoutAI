import React from "react";
import { IntelligenceLayer } from "./IntelligenceLayer";
import { UniversalToolTray, type ActionConfig } from "./UniversalToolTray";
import { ServiceDirectoryModule } from "./modules/ServiceDirectoryModule";
import { GasTrackerModule } from "./modules/GasTrackerModule";
import { EventDiscoveryModule } from "./modules/EventDiscoveryModule";
import type { ScoutMessage, ScoutCluster, ScoutAction } from "./state";

/* ----------------------------------------------------------
   MorphicRenderer — Morphic OS v2
   @reusable: morphic-renderer

   The frontend classification engine for Scout OS.
   Reads the existing LLM response fields (metadata.intent,
   clusters[].kind, message content) and decides which
   adaptive module to mount — no backend changes required.

   Classification priority:
   1. metadata.intent  (most specific, set by the decision pipeline)
   2. clusters[].kind  (structural hint from the LLM)
   3. Keyword heuristic on message content (fallback)

   Module registry:
   - SERVICE_DIRECTORY  → notaries, lawyers, banks, repair shops, etc.
   - GAS_TRACKER        → gas prices, fuel stations
   - EVENT_FEED         → community events, activities, things to do
   - MARKETPLACE        → buying/selling, listings, items
   - CONTRACTOR         → home pros, contractors, tradespeople
   - DEFAULT            → plain text response, no adaptive module

   To add a new module:
   1. Create the component in ./modules/
   2. Add its MorphicModuleType value below
   3. Add classification rules in classifyIntent()
   4. Add the case in renderModule()
   ---------------------------------------------------------- */

export type MorphicModuleType =
  | "SERVICE_DIRECTORY"
  | "GAS_TRACKER"
  | "EVENT_FEED"
  | "MARKETPLACE"
  | "CONTRACTOR"
  | "DEFAULT";

/* ----------------------------------------------------------
   @reusable: classifyIntent
   Pure function — derives a MorphicModuleType from a ScoutMessage.
   Can be used anywhere to classify a Scout response.
   ---------------------------------------------------------- */
export function classifyIntent(msg: ScoutMessage): MorphicModuleType {
  const intent = (msg.provenance as any)?.intent || (msg as any)?.metadata?.intent || "";
  const intentLower = intent.toLowerCase();
  const content = msg.content.toLowerCase();
  const clusterKinds = (msg.clusters || []).map((c: ScoutCluster) => c.kind);

  // 1. Intent-based classification (most reliable)
  if (/gas|fuel|station|petrol|price.*gas|gas.*price/.test(intentLower + " " + content)) {
    return "GAS_TRACKER";
  }
  if (
    /event|festival|market|concert|fair|activity|activities|things.*do|weekend/.test(
      intentLower + " " + content
    )
  ) {
    return "EVENT_FEED";
  }
  if (
    /notary|lawyer|attorney|bank|dmv|permit|license|document|notarize|insurance|accountant|tax|cpa/.test(
      intentLower + " " + content
    )
  ) {
    return "SERVICE_DIRECTORY";
  }
  if (
    /contractor|roofer|plumber|electrician|hvac|handyman|painter|landscap|remodel|repair.*home|home.*repair/.test(
      intentLower + " " + content
    )
  ) {
    return "CONTRACTOR";
  }

  // 2. Cluster kind classification
  if (clusterKinds.includes("marketplace")) return "MARKETPLACE";
  if (clusterKinds.includes("pros")) return "CONTRACTOR";
  if (clusterKinds.includes("community")) return "EVENT_FEED";

  // 3. Content keyword heuristic (broad fallback)
  if (/\$.*\/gal|per gallon|cheapest gas|gas near/.test(content)) return "GAS_TRACKER";
  if (/open now|hours|walk.in|appointment|available today/.test(content))
    return "SERVICE_DIRECTORY";
  if (/this (weekend|week|saturday|sunday)|tonight|happening|going on/.test(content))
    return "EVENT_FEED";
  if (/for sale|listing|buy|sell|price.*item|item.*price/.test(content)) return "MARKETPLACE";

  return "DEFAULT";
}

/* ----------------------------------------------------------
   @reusable: buildIntelligenceHeading
   Extracts the best heading text from a ScoutMessage for the
   Intelligence Layer card. Prefers the first sentence of the
   message content, truncated to a readable length.
   ---------------------------------------------------------- */
export function buildIntelligenceHeading(msg: ScoutMessage): {
  heading: string;
  subtext?: string;
} {
  const content = msg.content.trim();
  if (!content) return { heading: "" };

  // Split on first sentence boundary
  const sentenceEnd = content.search(/[.!?]\s/);
  if (sentenceEnd > 0 && sentenceEnd < 120) {
    const heading = content.slice(0, sentenceEnd + 1).trim();
    const rest = content.slice(sentenceEnd + 2).trim();
    const subtext =
      rest.length > 0 ? rest.slice(0, 160) + (rest.length > 160 ? "…" : "") : undefined;
    return { heading, subtext };
  }

  // No clean sentence break — use first 100 chars as heading
  const heading = content.length > 100 ? content.slice(0, 97) + "…" : content;
  return { heading };
}

/* ----------------------------------------------------------
   @reusable: buildContextLine
   Builds the "Context: X · Location: Y" meta line for the
   Intelligence Layer card from a ScoutMessage.
   ---------------------------------------------------------- */
export function buildContextLine(msg: ScoutMessage, locationLabel?: string): string | undefined {
  const parts: string[] = [];
  const intent = (msg.provenance as any)?.intent || (msg as any)?.metadata?.intent;
  if (intent) parts.push(`Context: ${intent}`);
  if (locationLabel && locationLabel.toLowerCase() !== "your area") {
    parts.push(`Location: ${locationLabel}`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/* ----------------------------------------------------------
   MorphicRenderer component
   ---------------------------------------------------------- */
interface MorphicRendererProps {
  /** The Scout message to render */
  msg: ScoutMessage;
  /** Called when the user taps a tool tray action */
  onAction?: (action: ScoutAction) => void;
  /** Current location label for context display */
  locationLabel?: string;
  /** Whether the message is still streaming */
  isStreaming?: boolean;
  /** Whether to show the Intelligence Layer card (default: true) */
  showIntelligenceLayer?: boolean;
}

export const MorphicRenderer: React.FC<MorphicRendererProps> = ({
  msg,
  onAction,
  locationLabel,
  isStreaming = false,
  showIntelligenceLayer = true,
}) => {
  const moduleType = classifyIntent(msg);
  const { heading, subtext } = buildIntelligenceHeading(msg);
  const context = buildContextLine(msg, locationLabel);

  /* Build the action tray config from the message's actions */
  const actionTrayConfig: ActionConfig[] = (msg.clusters || [])
    .flatMap((c: ScoutCluster) => c.actions || [])
    .slice(0, 3)
    .map((a: ScoutAction, i: number) => ({
      label: a.label || "Open",
      icon: a.type === "NAVIGATE" ? "map" : a.type === "PREFILL_INPUT" ? "search" : "plus",
      action: a.type,
      primary: i === 2,
    }));

  const renderModule = () => {
    switch (moduleType) {
      case "SERVICE_DIRECTORY": {
        /* Build ServiceDirectoryModule data from clusters */
        const services = (msg.clusters || []).map((c: ScoutCluster, idx: number) => ({
          id: c.id,
          name: c.title,
          category: c.body || "",
          rating: 0,
          reviewCount: 0,
          status: "OPEN" as const,
          statusText: "Open",
          distance: "",
          features: (c.items || []).map((item) => item.label),
          isTopRecommendation: idx === 0,
        }));
        if (services.length === 0) return null;
        return <ServiceDirectoryModule data={{ title: "Service Directory", services }} />;
      }

      case "GAS_TRACKER": {
        /* Build GasTrackerModule data from clusters */
        const stations = (msg.clusters || []).map((c: ScoutCluster) => ({
          id: c.id,
          name: c.title,
          address: c.body || "Address not verified",
          price: c.body?.match(/\$?([\d.]+)/)?.[1] || "0.00",
          distance: (c.items || [])[0]?.label || "",
          rating: 0,
          reportCount: 0,
          isCheapest: false,
        }));
        if (stations.length > 0) {
          const minPrice = Math.min(
            ...stations.map((s) => Number(s.price) || Number.POSITIVE_INFINITY)
          );
          stations.forEach((s) => {
            s.isCheapest = Number(s.price) === minPrice && Number.isFinite(minPrice);
          });
        }
        if (stations.length === 0) return null;
        return (
          <GasTrackerModule
            data={{
              title: "Price Comparison",
              trend: "Scout found these nearby options from the available local context.",
              stations,
            }}
          />
        );
      }

      case "EVENT_FEED": {
        /* Build EventDiscoveryModule data from clusters */
        const events = (msg.clusters || []).map((c: ScoutCluster) => ({
          id: c.id,
          title: c.title,
          description: c.body || "",
          time: (c.items || [])[0]?.label || "Time not listed",
          location: (c.items || [])[1]?.label || "",
          rating: 0,
          imageUrl: "",
          tags: [c.kind],
        }));
        if (events.length === 0) return null;
        return (
          <EventDiscoveryModule
            data={{ title: "Local Activity", locationLabel: locationLabel || "Your area", events }}
          />
        );
      }

      case "CONTRACTOR":
      case "MARKETPLACE":
      case "DEFAULT":
      default:
        /* For these types, the existing ClusterCard rendering in ScoutThread
           handles the display. MorphicRenderer only adds the Intelligence Layer
           card and action tray on top. */
        return null;
    }
  };

  const module = renderModule();

  return (
    /* @reusable: morphic-canvas — the full Scout response canvas */
    <div className="morphic-canvas w-full">
      {/* Intelligence Layer card — always shown for assistant messages */}
      {showIntelligenceLayer && heading && (
        <IntelligenceLayer
          heading={heading}
          subtext={subtext}
          context={context}
          isStreaming={isStreaming}
        />
      )}

      {/* Adaptive module — only shown when a specific module is matched */}
      {module && <div className="mt-3">{module}</div>}

      {/* Universal Tool Tray — shown when there are cluster actions */}
      {actionTrayConfig.length > 0 && onAction && (
        <UniversalToolTray
          actions={actionTrayConfig}
          onAction={(actionStr) => {
            const matched = (msg.clusters || [])
              .flatMap((c: ScoutCluster) => c.actions || [])
              .find((a: ScoutAction) => a.type === actionStr);
            if (matched) onAction(matched);
          }}
        />
      )}
    </div>
  );
};
