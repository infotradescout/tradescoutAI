import { JwStoneLoadingStatus } from "./JwStoneLoadingStatus";
import {
  createJwStoneComponentLoader,
  useJwStoneDeferredComponent,
} from "./deferredJwStoneComponent";

export type JwStoneEmployeeToolsProps = {
  viewerId: string;
  enabled: boolean;
  canManageStaff: boolean;
  onEnter?: () => void;
};
const loadTools = createJwStoneComponentLoader<JwStoneEmployeeToolsProps>(() =>
  import("./JwStoneEmployeeTools").then((module) => module.default)
);

/** Mounted only after the parent confirms this viewer's employee permission. */
export function JwStoneEmployeeToolsLoader(props: JwStoneEmployeeToolsProps) {
  const { Component: Tools, failed, retry } = useJwStoneDeferredComponent(loadTools);

  if (Tools) return <Tools {...props} />;
  return (
    <section
      aria-label="JW Stone employee tools"
      className="mx-auto max-w-[1600px] px-5 py-4 text-[var(--jw-ink)]"
    >
      <JwStoneLoadingStatus subject="employee tools" failed={failed} retry={retry} />
    </section>
  );
}
