import React from "react";

interface ScoutHeaderProps {
  isAuthenticated: boolean;
  isFirstGuestVisit: boolean;
  locationLabel?: string;
}

export function ScoutHeader({ isAuthenticated, isFirstGuestVisit, locationLabel }: ScoutHeaderProps) {
  const communityText = locationLabel && locationLabel.toLowerCase() !== "your area" 
    ? locationLabel 
    : "Your Community";

  return (
    <header className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Empowering <span style={{ color: 'var(--orange-primary)' }}>{communityText}</span>
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
