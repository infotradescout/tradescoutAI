import { useEffect, useMemo, useState } from "react";

function computeIsStandalone(): boolean {
  if (typeof window === "undefined") return false;

  // iOS Safari exposes navigator.standalone when launched from home screen.
  const iosStandalone = Boolean((navigator as any)?.standalone);
  const displayModeStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  return iosStandalone || displayModeStandalone;
}

export function useIsStandalone() {
  const [isStandalone, setIsStandalone] = useState<boolean>(() => computeIsStandalone());

  const mql = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.matchMedia?.("(display-mode: standalone)") ?? null;
  }, []);

  useEffect(() => {
    const update = () => setIsStandalone(computeIsStandalone());
    update();

    window.addEventListener("appinstalled", update);

    if (mql) {
      // Safari uses addListener/removeListener; modern browsers use addEventListener.
      const anyMql = mql as any;
      if (typeof anyMql.addEventListener === "function") {
        anyMql.addEventListener("change", update);
      } else if (typeof anyMql.addListener === "function") {
        anyMql.addListener(update);
      }
    }

    return () => {
      window.removeEventListener("appinstalled", update);
      if (!mql) return;
      const anyMql = mql as any;
      if (typeof anyMql.removeEventListener === "function") {
        anyMql.removeEventListener("change", update);
      } else if (typeof anyMql.removeListener === "function") {
        anyMql.removeListener(update);
      }
    };
  }, [mql]);

  return isStandalone;
}

