import { ReactNode, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocationContext, hasCountyContext, type LocationContext } from "@/hooks/useLocationContext";
import { recordActivity } from "../agent/activity";
import { useAuth } from "@/hooks/useAuth";

interface CountyRequiredGateProps {
  locationOverride?: LocationContext | null;
  children: ReactNode;
  surface?: "community" | "exchange" | "hoa_dashboard" | "hoa_management" | "leaderboard" | string;
}

/**
 * Standard gate for county-committed experiences.
 * If there is no committed county, shows neutral copy and a single
 * CTA that routes to Settings → Location. Otherwise renders children.
 */
export function CountyRequiredGate({ locationOverride, children, surface }: CountyRequiredGateProps) {
  const { user } = useAuth() as any;
  // Canonical gate: user-level committed location, not ad-hoc context
  const hasCanonicalLocation = !!(
    user &&
    (((user as any).locationCommitted as boolean | undefined) ||
      (((user as any).stateCode && (user as any).countyFips)))
  );

  const ctx = locationOverride ?? useLocationContext();

  useEffect(() => {
    if (hasCanonicalLocation) return;

    const surf = surface || "unknown";

    recordActivity({
      type: "county_gate_hit",
      ts: new Date().toISOString(),
      path: typeof window !== "undefined" ? window.location.pathname : "", 
      meta: { surface: surf },
    });

    try {
      if (
        typeof window !== "undefined" &&
        window.localStorage.getItem("scout:county_explained:v1") === "1"
      ) {
        recordActivity({
          type: "county_gate_rehit_after_explained",
          ts: new Date().toISOString(),
          path: window.location.pathname,
          meta: { surface: surf },
        });
      }
    } catch {
      // Ignore storage/telemetry failures.
    }
  }, [hasCanonicalLocation, surface]);

  if (hasCanonicalLocation) {
    return <>{children}</>;
  }

  const areaLabel = ctx.label || "your area";

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <Card className="bg-slate-950/70 border-slate-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg md:text-xl text-white">
            Set your county to unlock local features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300">
            TradeScout uses your saved county to power community feed, marketplace, and other local experiences. Choose
            your county so what you see lines up with where you actually live.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-slate-400">
              Current location context: <span className="font-medium text-slate-100">{areaLabel}</span>
            </p>
            <Button
              type="button"
              className="bg-orange-500 hover:bg-orange-600 text-black text-xs font-semibold px-4 py-2 rounded-md"
              asChild
            >
              <a href="/settings">Set your county</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
