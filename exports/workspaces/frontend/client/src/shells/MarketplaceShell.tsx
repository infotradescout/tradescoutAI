import type { ReactNode } from "react";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import type { LocationContext } from "@/hooks/useLocationContext";

interface MarketplaceShellProps {
  children: ReactNode;
  locationOverride?: LocationContext | null;
}

export function MarketplaceShell({ children, locationOverride }: MarketplaceShellProps) {
  return (
    <div className="w-full">
      <CountyRequiredGate locationOverride={locationOverride} surface="community">
        {children}
      </CountyRequiredGate>
    </div>
  );
}
