import React from "react";

interface ScoutHeaderProps {
  isAuthenticated: boolean;
  isFirstGuestVisit: boolean;
}

export function ScoutHeader({ isAuthenticated, isFirstGuestVisit }: ScoutHeaderProps) {
  return (
    <header className="space-y-1 text-center">
      <p className="text-[11px] font-semibold text-slate-400">Scout</p>
      {!isAuthenticated && (
        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
          {isFirstGuestVisit
            ? "You can explore without an account. Sign in when you want to save, post, or message."
            : "Sign in whenever you want to save, post, or message."}
        </p>
      )}
    </header>
  );
}
