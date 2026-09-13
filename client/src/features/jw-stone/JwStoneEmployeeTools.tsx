import { useEffect, useState } from "react";
import JwStoneReceivingWorkspace from "./JwStoneReceivingWorkspace";
import JwStoneEmployeeAccessManager from "./JwStoneEmployeeAccessManager";
import type { JwStoneEmployeeToolsProps } from "./JwStoneEmployeeToolsLoader";

/** The authorized employee chunk retains the original editor and draft owners. */
export default function JwStoneEmployeeTools({
  viewerId,
  enabled,
  canManageStaff,
  onEnter,
}: JwStoneEmployeeToolsProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    // Release the account modal's pointer/focus ownership before mounting the
    // native receiving dialog. Reopening the account form later stays possible.
    onEnter?.();
    setReady(true);
  }, [onEnter, ready]);
  if (!ready) return null;
  return (
    <>
      <JwStoneReceivingWorkspace key={viewerId} viewerId={viewerId} enabled={enabled} />
      {canManageStaff ? (
        <JwStoneEmployeeAccessManager key={`staff:${viewerId}`} viewerId={viewerId} />
      ) : null}
    </>
  );
}
