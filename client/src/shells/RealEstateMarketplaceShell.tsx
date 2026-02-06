import type { ReactNode } from "react";

interface RealEstateMarketplaceShellProps {
  children: ReactNode;
}

export function RealEstateMarketplaceShell({ children }: RealEstateMarketplaceShellProps) {
  return <div className="w-full">{children}</div>;
}
