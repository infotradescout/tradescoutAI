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
      <div className="scout-header-eyebrow">TradeScout • Scout Operating Layer</div>
      <h1
        className="text-xl md:text-2xl font-medium tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {hasSpecificLocation && communityText
          ? `What local outcome are you trying to move forward in ${communityText}?`
          : "What local outcome are you trying to move forward?"}
      </h1>
      <p
        className="text-[12px] md:text-[13px] max-w-md mx-auto md:mx-0"
        style={{ color: "var(--text-muted)" }}
      >
        {isAuthenticated
          ? "Ask plainly. Scout will interpret the need, explain the next step, and keep action governed."
          : isFirstGuestVisit
            ? "Explore first. Scout can map the right path before you decide to save progress or open contact."
            : "Sign in only when you need to save progress or open contact."}
      </p>
    </header>
  );
}
