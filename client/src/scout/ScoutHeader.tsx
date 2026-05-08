import React from "react";
import { formatCityOnly } from "@/utils/locationDisplay";

interface ScoutHeaderProps {
  isAuthenticated: boolean;
  isFirstGuestVisit: boolean;
  locationLabel?: string;
}

export function ScoutHeader({
  isAuthenticated,
  isFirstGuestVisit,
  locationLabel,
}: ScoutHeaderProps) {
  const hasSpecificLocation = !!locationLabel && locationLabel.toLowerCase() !== "your area";
  const cityOnly = hasSpecificLocation ? formatCityOnly({ label: locationLabel }) : "";
  const communityText = hasSpecificLocation && cityOnly ? cityOnly : "your area";

  return (
    <header className="scout-header scout-header-refined space-y-4 text-left">
      <div className="inline-flex items-center rounded-full border border-ts-orange/25 bg-ts-orange/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ts-orange">
        Search TradeScout
      </div>
      <h1
        className="max-w-2xl font-display text-[2.15rem] md:text-5xl font-bold tracking-tight leading-[1.02]"
        style={{ color: "var(--text-primary)" }}
      >
        {hasSpecificLocation && communityText
          ? `What are you looking for near ${communityText}?`
          : "What are you looking for?"}
      </h1>
      {!isAuthenticated && (
        <p
          className="max-w-2xl text-[13px] md:text-[15px] leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {isFirstGuestVisit
            ? "Use Scout like search. Find pages, people, services, requests, prices, rules, events, and useful local updates."
            : "Search TradeScout or ask what is nearby. Sign in when you want to save something or come back to it later."}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {["Search the site", "Who can help", "What's nearby", "Prices & rules"].map((label) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/75"
          >
            {label}
          </div>
        ))}
      </div>
    </header>
  );
}
