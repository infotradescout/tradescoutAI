import React from "react";
import { Button } from "@/components/ui/button";
import type { ScoutAction } from "./state";

type ScoutResultActionCardProps = {
  query: string;
  localityLabel?: string;
  onAction?: (action: ScoutAction) => void;
};

type ActionCardModel = {
  title: string;
  summary: string;
  actions: ScoutAction[];
  reviewNote?: string;
};

function classifyQueryIntent(
  query: string
): "home_repair" | "vehicle" | "listing" | "provider" | "price" | "community" {
  const q = String(query || "").toLowerCase();
  if (/(price|prices|pricing|cost|quote|market value|fair value)/.test(q)) return "price";
  if (/(vehicle|car|truck|f-150|service|mechanic|oil|brake|tire)/.test(q)) return "vehicle";
  if (/(listing|exchange|sell|buy|materials|tools|used truck|property)/.test(q)) return "listing";
  if (/(community|event|events|post|nearby activity)/.test(q)) return "community";
  if (/(provider|local help|contractor|plumber|electrician|roofer|notary)/.test(q))
    return "provider";
  return "home_repair";
}

function buildCardModel(query: string, localityLabel?: string): ActionCardModel {
  const where = localityLabel ? ` near ${localityLabel}` : " near you";
  const intent = classifyQueryIntent(query);

  if (intent === "vehicle") {
    return {
      title: `Vehicle help${where}`,
      summary: "Search service, repair, records, or listings tied to your vehicle.",
      actions: [
        { type: "NAVIGATE", label: "Start service request", to: "/direct-connect" },
        { type: "NAVIGATE", label: "Search vehicle listings", to: "/exchange?category=vehicles" },
        { type: "NAVIGATE", label: "Open Vehicle Vault", to: "/vehicles" },
        {
          type: "ASK_SCOUT",
          label: "Compare prices",
          prompt: "Compare local vehicle service prices.",
        },
      ],
    };
  }

  if (intent === "listing") {
    return {
      title: `Local listings${where}`,
      summary: "Search tools, materials, vehicles, property, and local offers.",
      actions: [
        { type: "NAVIGATE", label: "Browse Exchange", to: "/exchange" },
        {
          type: "ASK_SCOUT",
          label: "Save search",
          prompt: "Save this search and alert me on changes.",
        },
        {
          type: "ASK_SCOUT",
          label: "Compare prices",
          prompt: "Compare local listing prices for this.",
        },
        { type: "NAVIGATE", label: "Create listing", to: "/marketplace-listing" },
      ],
    };
  }

  if (intent === "provider") {
    return {
      title: `Local help${where}`,
      summary: "Compare options before contact opens.",
      actions: [
        { type: "NAVIGATE", label: "Find local help", to: "/direct-connect/pros" },
        { type: "NAVIGATE", label: "View saved providers", to: "/direct-connect/pros" },
        { type: "NAVIGATE", label: "Start request", to: "/direct-connect" },
        {
          type: "ASK_SCOUT",
          label: "Review what to verify",
          prompt: "What should I verify before contact?",
        },
      ],
      reviewNote: "You review before anything is shared.",
    };
  }

  if (intent === "price") {
    return {
      title: `Price check${where}`,
      summary: "Compare local prices before buying, selling, or requesting work.",
      actions: [
        { type: "ASK_SCOUT", label: "Compare prices", prompt: "Compare local prices for this." },
        { type: "NAVIGATE", label: "Search listings", to: "/exchange" },
        {
          type: "ASK_SCOUT",
          label: "Check materials",
          prompt: "Show material price ranges for this.",
        },
        {
          type: "ASK_SCOUT",
          label: "Save search",
          prompt: "Save this search and notify me on changes.",
        },
      ],
    };
  }

  if (intent === "community") {
    return {
      title: `Nearby activity${where}`,
      summary: "See posts, events, and local updates around your area.",
      actions: [
        { type: "NAVIGATE", label: "Open Community", to: "/community" },
        { type: "ASK_SCOUT", label: "See events", prompt: "Show nearby events this week." },
        { type: "ASK_SCOUT", label: "Search nearby", prompt: "Search nearby posts and activity." },
        { type: "ASK_SCOUT", label: "Save area", prompt: "Save this area for activity updates." },
      ],
    };
  }

  return {
    title: `Home repair${where}`,
    summary: "Start with the issue, location, timing, photos, and what you have already checked.",
    actions: [
      { type: "NAVIGATE", label: "Start a request", to: "/direct-connect" },
      { type: "ASK_SCOUT", label: "Compare local prices", prompt: "Compare local repair prices." },
      {
        type: "ASK_SCOUT",
        label: "Check materials",
        prompt: "Check materials and price ranges for this repair.",
      },
      { type: "NAVIGATE", label: "Find local help", to: "/direct-connect/pros" },
    ],
    reviewNote: "You review before anything is shared.",
  };
}

export function ScoutResultActionCard({
  query,
  localityLabel,
  onAction,
}: ScoutResultActionCardProps) {
  const model = React.useMemo(() => buildCardModel(query, localityLabel), [query, localityLabel]);
  if (!query.trim()) return null;

  return (
    <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-3">
      <h3 className="text-base font-semibold text-[color:var(--text-primary)]">{model.title}</h3>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{model.summary}</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {model.actions.map((action) => (
          <Button
            key={`${action.type}-${action.label}`}
            type="button"
            variant="outline"
            className="justify-start text-left"
            onClick={() => onAction?.(action)}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {model.reviewNote ? (
        <p className="mt-3 text-xs text-[color:var(--text-secondary)]">{model.reviewNote}</p>
      ) : null}
    </div>
  );
}
