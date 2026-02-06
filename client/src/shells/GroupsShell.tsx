import type { ReactNode } from "react";

interface GroupsShellProps {
  children: ReactNode;
}

export function GroupsShell({ children }: GroupsShellProps) {
  return <div className="">{children}</div>;
}
