import React from "react";

interface ScoutHeaderProps {
  isAuthenticated: boolean;
  isFirstGuestVisit: boolean;
  locationLabel?: string;
}

export function ScoutHeader({ isAuthenticated, isFirstGuestVisit, locationLabel }: ScoutHeaderProps) {
  const hasSpecificLocation = !!locationLabel && locationLabel.toLowerCase() !== "your area";
  const communityText = hasSpecificLocation ? locationLabel! : "Your Community";

  return (
    <header className="space-y-2 text-center">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {hasSpecificLocation ? `Empowering ${communityText}` : "Empowering Your Community"}
      </h1>
      <p className="text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Scout</p>
      {!isAuthenticated && (
        <p className="text-[13px] max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
          {isFirstGuestVisit
            ? "You can explore without an account. Sign in when you want to save, post, or message."
            : "Sign in whenever you want to save, post, or message."}
        </p>
      )}
    </header>
  );
}
