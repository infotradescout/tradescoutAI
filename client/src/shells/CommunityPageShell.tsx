import type { ReactNode } from "react";
import { CommunityShell } from "@/components/layout/CommunityShell";

interface CommunityPageShellProps {
  children: ReactNode;
}

export function CommunityPageShell({ children }: CommunityPageShellProps) {
  return <CommunityShell sectionLabel="Community Feed">{children}</CommunityShell>;
}
