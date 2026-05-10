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

  return (
    <header className="scout-header scout-header-refined space-y-4 text-left">
      <div className="inline-flex items-center rounded-full border border-ts-orange/25 bg-ts-orange/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ts-orange">
        Scout
      </div>
      <h1
        className="max-w-2xl font-display text-[2.15rem] md:text-5xl font-bold tracking-tight leading-[1.02]"
        style={{ color: "var(--text-primary)" }}
      >
        What do you need help with today?
      </h1>
      <p
        className="max-w-2xl text-[13px] md:text-[15px] leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        Scout helps you find local contractors, compare options, and know what to check before you
        contact anyone{hasSpecificLocation && communityText ? ` near ${communityText}` : ""}.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Fix something", "AC, plumbing, electrical, roof, appliance"],
          ["Start a project", "Concrete, remodel, fencing, land work"],
          ["Compare prices", "See normal ranges before calling"],
          ["Find trusted local help", "Verified pages and nearby signals"],
          ["Ask a question", "Quotes, who handles this, what to do first"],
        ].map(([label, detail]) => (
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
