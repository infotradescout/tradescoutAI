// Utility to detect Facebook/Instagram in-app browsers
export const isFacebookInAppBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram/i.test(ua);
};

// Optional React hook for convenience
import { useMemo } from "react";
export function useInAppBrowser(): boolean {
  return useMemo(() => isFacebookInAppBrowser(), []);
}
