import { ReactNode, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  useLocationContext,
  hasCountyContext,
  hasPendingCountyResolution,
  type LocationContext,
} from "@/hooks/useLocationContext";
import { recordActivity } from "../agent/activity";

interface CountyRequiredGateProps {
  locationOverride?: LocationContext | null;
  children: ReactNode;
  surface?: "community" | "exchange" | "hoa_dashboard" | "hoa_management" | "leaderboard" | string;
  allowBypass?: boolean;
}

/**
 * Standard gate for county-committed experiences.
 * If there is no committed county, shows neutral copy and a single
 * CTA that routes to Settings → Location. Otherwise renders children.
 */
export function CountyRequiredGate({
  locationOverride,
  children,
  surface,
  allowBypass,
}: CountyRequiredGateProps) {
  const ctx = locationOverride ?? useLocationContext();
  const hasCanonicalLocation = hasCountyContext(ctx);
  const pendingCountyResolution = hasPendingCountyResolution(ctx);

  useEffect(() => {
    if (hasCanonicalLocation || pendingCountyResolution) return;

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
  }, [hasCanonicalLocation, pendingCountyResolution, surface]);

  if (hasCanonicalLocation || allowBypass) {
    return <>{children}</>;
  }

  const areaLabel = ctx.label || "your area";
  const isCommunitySurface = surface === "community";

  if (pendingCountyResolution) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <Card className="bg-black/30 border-white/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl text-white">Finalizing your county</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/70">
              TradeScout has your saved county for{" "}
              <span className="font-medium text-white">{areaLabel}</span> and is linking it to the
              official county record now.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-white/60">
                If this does not update shortly, review your county settings.
              </p>
              <Button
                type="button"
                className="bg-ts-orange hover:bg-ts-orange-dark text-black text-xs font-semibold px-4 py-2 rounded-md"
                asChild
              >
                <Link href="/settings">Review county</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCommunitySurface) {
    return (
      <>
        <div className="mx-auto mb-3 w-full max-w-2xl px-1">
          <Card className="border-white/10 bg-black/25">
            <CardContent className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  Set your county for local matching
                </p>
                <p className="text-xs text-white/65">Current context: {areaLabel}</p>
              </div>
              <Button
                type="button"
                className="bg-ts-orange hover:bg-ts-orange-dark text-black text-xs font-semibold px-4 py-2 rounded-md"
                asChild
              >
                <Link href="/settings">Set county</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <Card className="bg-black/30 border-white/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg md:text-xl text-white">Set your county</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-white/70">
            Choose your county so local results match where you live.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-white/60">
              Current context: <span className="font-medium text-white">{areaLabel}</span>
            </p>
            <Button
              type="button"
              className="bg-ts-orange hover:bg-ts-orange-dark text-black text-xs font-semibold px-4 py-2 rounded-md"
              asChild
            >
              <Link href="/settings">Set your county</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
