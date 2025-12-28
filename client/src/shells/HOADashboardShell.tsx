import type { ReactNode } from "react";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import type { LocationContext } from "@/hooks/useLocationContext";

interface HOADashboardShellProps {
  children: ReactNode;
  locationOverride?: LocationContext | null;
}

export function HOADashboardShell({ children, locationOverride }: HOADashboardShellProps) {
  return (
    <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
      <CountyRequiredGate locationOverride={locationOverride}>
        <div className="w-full py-8">
          {children}
        </div>
      </CountyRequiredGate>
    </div>
  );
}
