import type { ReactNode } from "react";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import type { LocationContext } from "@/hooks/useLocationContext";

interface HOADashboardShellProps {
  children: ReactNode;
  locationOverride?: LocationContext | null;
}

export function HOADashboardShell({ children, locationOverride }: HOADashboardShellProps) {
  return (
    <div className="w-full">
      <CountyRequiredGate locationOverride={locationOverride}>
        <div className="w-full">{children}</div>
      </CountyRequiredGate>
    </div>
  );
}
