import type { ReactNode } from "react";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import type { LocationContext } from "@/hooks/useLocationContext";

interface MarketplaceShellProps {
  children: ReactNode;
  locationOverride?: LocationContext | null;
}

export function MarketplaceShell({ children, locationOverride }: MarketplaceShellProps) {
  return (
    <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
      <CountyRequiredGate locationOverride={locationOverride} surface="community">
        <div className="max-w-5xl mx-auto px-3 py-4 sm:px-4 sm:py-6">
          {children}
        </div>
      </CountyRequiredGate>
    </div>
  );
}
