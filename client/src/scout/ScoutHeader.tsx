import React from "react";
import { formatCityOnly } from "@/utils/locationDisplay";

interface ScoutHeaderProps {
  isAuthenticated: boolean;
  isFirstGuestVisit: boolean;
  locationLabel?: string;
}

export function ScoutHeader({ locationLabel }: ScoutHeaderProps) {
  const hasSpecificLocation = !!locationLabel && locationLabel.toLowerCase() !== "your area";
  const cityOnly = hasSpecificLocation ? formatCityOnly({ label: locationLabel }) : "";
  const communityText = hasSpecificLocation && cityOnly ? cityOnly : "your area";
  const headerCards = [
    ["Search local businesses", "Contractors, services, and people nearby"],
    ["Review next step", "Saved context, request details, and what to check first"],
    ["Check prices", "Normal ranges before you call anyone"],
    ["Local results", "Nearby posts, requests, and useful signals"],
    ["Start a material run", "Send a material list or supplier link to turn it into a Supply Run."],
    ["Open messages", "Review conversations when contact is already open"],
  ] as const;

  return (
    <header className="scout-header scout-header-refined space-y-4 text-left">
      <div className="inline-flex items-center rounded-full border border-ts-orange/25 bg-ts-orange/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ts-orange">
        Scout
      </div>
      <h1
        className="max-w-2xl font-display text-[2.15rem] md:text-5xl font-bold tracking-tight leading-[1.02]"
        style={{ color: "var(--text-primary)" }}
      >
        Search local options and choose the next step.
      </h1>
      <p
        className="max-w-2xl text-[13px] md:text-[15px] leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        Review local activity, request context, and what to check before contact opens
        {hasSpecificLocation && communityText ? ` near ${communityText}` : ""}.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {headerCards.map(([label, detail]) => (
          <div
            key={label}
            className="rounded-xl border px-3 py-3 text-left"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--surface-card)",
              color: "var(--text-primary)",
            }}
          >
            <div className="text-sm font-semibold">{label}</div>
            <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {detail}
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}
