import { useEffect, useState } from "react";

export type Handedness = "right" | "left";

export function useHandedness(): Handedness {
  const [handedness, setHandedness] = useState<Handedness>("right");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("ts:handedness");
      if (stored === "left" || stored === "right") {
        setHandedness(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  return handedness;
}
