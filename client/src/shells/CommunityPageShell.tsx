import type { ReactNode } from "react";

interface CommunityPageShellProps {
  children: ReactNode;
}

export function CommunityPageShell({ children }: CommunityPageShellProps) {
  return (
    <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
      {children}
    </div>
  );
}
