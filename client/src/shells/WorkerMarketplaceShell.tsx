import type { ReactNode } from "react";

interface WorkerMarketplaceShellProps {
  children: ReactNode;
}

export function WorkerMarketplaceShell({ children }: WorkerMarketplaceShellProps) {
  return (
    <div className="">
      <div className="max-w-7xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8 pb-20">
        {children}
      </div>
    </div>
  );
}
