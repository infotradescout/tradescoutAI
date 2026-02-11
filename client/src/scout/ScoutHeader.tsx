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
    <header className="space-y-2 text-center">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {hasSpecificLocation && communityText
          ? `What can Scout help you get done in ${communityText}?`
          : "What do you need help with today?"}
      </h1>
      {!isAuthenticated && (
        <p className="text-[13px] max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
          {isFirstGuestVisit
            ? "Explore freely. Sign in to save or contact."
            : "Sign in to save or contact."}
        </p>
      )}
    </header>
  );
}
