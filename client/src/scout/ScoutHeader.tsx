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
      <div className="scout-header-eyebrow">TradeScout • Scout</div>
      <h1
        className="text-xl md:text-2xl font-medium tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {hasSpecificLocation && communityText
          ? `What do you need help with in ${communityText}?`
          : "What do you need help with?"}
      </h1>
      <p
        className="text-[12px] md:text-[13px] max-w-md mx-auto md:mx-0"
        style={{ color: "var(--text-muted)" }}
      >
        {isAuthenticated
          ? "Ask plainly. Scout will route you to the right next step."
          : isFirstGuestVisit
            ? "Explore first. Sign in when you want to save or contact."
            : "Sign in when you want to save or contact."}
      </p>
    </header>
  );
}
