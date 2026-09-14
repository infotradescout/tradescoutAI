import { lazy, Suspense, type ComponentProps } from "react";

const CabinetInteractivePlan = lazy(() => import("./CabinetInteractivePlan"));

/** Direct placement is loaded only for the plan view, not the starter, elevations or 3D. */
export default function CabinetPlanView(props: ComponentProps<typeof CabinetInteractivePlan>) {
  return <Suspense fallback={<div role="status" aria-live="polite" className="grid min-h-[24rem] place-items-center bg-[#ede7dd] p-6 text-sm font-semibold text-[#18312f]">Loading measured cabinet plan…</div>}>
    <CabinetInteractivePlan {...props} />
  </Suspense>;
}
