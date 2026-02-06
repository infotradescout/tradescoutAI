import type { ReactNode } from "react";

interface CommunityPageShellProps {
  children: ReactNode;
}

export function CommunityPageShell({ children }: CommunityPageShellProps) {
  return <div className="">{children}</div>;
}
