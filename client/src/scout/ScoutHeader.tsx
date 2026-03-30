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
          ? `What do you need to get done in ${communityText}?`
          : "What do you need to get done?"}
      </h1>
      <p
        className="text-[12px] md:text-[13px] max-w-md mx-auto md:mx-0"
        style={{ color: "var(--text-muted)" }}
      >
        {isAuthenticated
          ? "Tell Scout your goal in plain language. You'll get the next best step without digging through the site."
          : isFirstGuestVisit
            ? "Explore first. Scout can show you the right path before you decide to save progress or open contact."
            : "Sign in when you want to save progress or open contact."}
      </p>
    </header>
  );
}
