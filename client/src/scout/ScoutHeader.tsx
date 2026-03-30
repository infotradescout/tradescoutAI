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
    <header className="scout-header space-y-2 text-center md:text-left">
      <div className="scout-header-eyebrow">TradeScout • Ask Scout</div>
      <h1
        className="text-xl md:text-2xl font-medium tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {hasSpecificLocation && communityText
          ? `What do you need to get done in ${communityText}?`
          : "What do you need to get done?"}
      </h1>
      <p
        className="text-[12px] md:text-[13px] max-w-md mx-auto md:mx-0"
        style={{ color: "var(--text-muted)" }}
      >
        {isAuthenticated
          ? "Tell Scout what you need in plain language and it will point you to the right next step."
          : isFirstGuestVisit
            ? "Start here if you want the clearest path before you save progress or open contact."
            : "Sign in when you want to save this or come back to it later."}
      </p>
    </header>
  );
}
