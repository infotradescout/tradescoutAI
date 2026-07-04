import { useEffect } from "react";
import { useLocation } from "wouter";
import { buildAuthEntryRoute } from "@/lib/postOnboardingRoute";

export default function Signup() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = (params.get("next") || "").trim();
    setLocation(buildAuthEntryRoute({ mode: "create", next }));
  }, [setLocation]);

  return null;
}
