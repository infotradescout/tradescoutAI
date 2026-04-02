import type { ReactNode } from "react";

interface WorkerMarketplaceShellProps {
  children: ReactNode;
}

export function WorkerMarketplaceShell({ children }: WorkerMarketplaceShellProps) {
  return <div className="w-full">{children}</div>;
}
