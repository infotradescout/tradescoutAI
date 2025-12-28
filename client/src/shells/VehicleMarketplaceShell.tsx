import type { ReactNode } from "react";

interface VehicleMarketplaceShellProps {
  children: ReactNode;
}

export function VehicleMarketplaceShell({ children }: VehicleMarketplaceShellProps) {
  return (
    <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
      <div className="container mx-auto px-4 py-8 pb-20">
        {children}
      </div>
    </div>
  );
}
