import type { ReactNode } from "react";

interface GroupsShellProps {
  children: ReactNode;
}

export function GroupsShell({ children }: GroupsShellProps) {
  return (
    <div className="w-full max-w-full overflow-x-hidden bg-slate-950">
      {children}
    </div>
  );
}
