import JwStoneReceivingWorkspace from "./JwStoneReceivingWorkspace";
import JwStoneEmployeeAccessManager from "./JwStoneEmployeeAccessManager";
import type { JwStoneEmployeeToolsProps } from "./JwStoneEmployeeToolsLoader";

/** The authorized employee chunk retains the original editor and draft owners. */
export default function JwStoneEmployeeTools({
  viewerId,
  enabled,
  canManageStaff,
}: JwStoneEmployeeToolsProps) {
  return (
    <>
      <JwStoneReceivingWorkspace key={viewerId} viewerId={viewerId} enabled={enabled} />
      {canManageStaff ? (
        <JwStoneEmployeeAccessManager key={`staff:${viewerId}`} viewerId={viewerId} />
      ) : null}
    </>
  );
}
