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
        TradeScout Data Factory
      </div>
      <h1
        className="max-w-2xl font-display text-[2.15rem] md:text-5xl font-bold tracking-tight leading-[1.02]"
        style={{ color: "var(--text-primary)" }}
      >
        {hasSpecificLocation && communityText
          ? `Launch a scouting mission in ${communityText}.`
          : "Launch a scouting mission."}
      </h1>
      {!isAuthenticated && (
        <p
          className="max-w-2xl text-[13px] md:text-[15px] leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {isFirstGuestVisit
            ? "Scout gathers codes, prices, county context, and market signals before routing the next step."
            : "Run the mission first. Sign in when you want to save the trail."}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {["Knowledge base", "County data", "Live context", "LISA routing"].map((label) => (
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
