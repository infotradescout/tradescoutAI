import type { AdminTool } from "./adminTools";
import { useEffect, useState } from "react";

/** Expire saved observations even when network polling pauses offline or in the background. */
export function useAdminObservationClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 15_000);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return now;
}

export function knownQueueCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function queueDestination(tool: Pick<AdminTool, "id" | "path">): string {
  return tool.id === "commercial-directory" ? `${tool.path}?tab=verification` : tool.path;
}

export function adminSourceState({
  loading,
  error,
  enabled = true,
  observedAt,
  now = Date.now(),
}: {
  loading: boolean;
  error: boolean;
  enabled?: boolean;
  observedAt?: string | number | null;
  now?: number;
}): "Loading" | "Unavailable" | "Not available for this role" | "Stale" | "Current" {
  if (!enabled) return "Not available for this role";
  if (error) return "Unavailable";
  if (loading) return "Loading";
  const time = typeof observedAt === "number" ? observedAt : Date.parse(observedAt || "");
  if (!Number.isFinite(time) || time <= 0 || time > now + 60_000) return "Unavailable";
  return now - time > 90_000 ? "Stale" : "Current";
}

export async function refreshAdminSources(
  queues: () => Promise<unknown>,
  signalsAllowed: boolean,
  mission: () => Promise<unknown>,
  snapshots: () => Promise<unknown>
) {
  return Promise.allSettled([queues(), ...(signalsAllowed ? [mission(), snapshots()] : [])]);
}

export function snapshotEvidenceKnown(statuses: unknown, now = Date.now()): boolean {
  return (
    Array.isArray(statuses) &&
    statuses.length > 0 &&
    statuses.every(
      (status) =>
        status &&
        typeof status.isStale === "boolean" &&
        knownQueueCount(status.rowCount) !== null &&
        ((status.latestComputedAt === null && status.isStale) ||
          (typeof status.latestComputedAt === "string" &&
            Number.isFinite(Date.parse(status.latestComputedAt)) &&
            Date.parse(status.latestComputedAt) <= now + 60_000))
    )
  );
}
