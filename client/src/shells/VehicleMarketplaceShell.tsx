import type { ReactNode } from "react";

interface VehicleMarketplaceShellProps {
  children: ReactNode;
}

export function VehicleMarketplaceShell({ children }: VehicleMarketplaceShellProps) {
  return <div className="w-full">{children}</div>;
}
