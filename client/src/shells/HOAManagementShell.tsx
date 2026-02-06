import type { ReactNode } from "react";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import type { LocationContext } from "@/hooks/useLocationContext";

interface HOAManagementShellProps {
  children: ReactNode;
  locationOverride?: LocationContext | null;
}

export function HOAManagementShell({ children, locationOverride }: HOAManagementShellProps) {
  return (
    <div className="">
      <CountyRequiredGate locationOverride={locationOverride}>
        <div className="max-w-7xl mx-auto space-y-8" data-testid="hoa-management-page">
          {children}
        </div>
      </CountyRequiredGate>
    </div>
  );
}
