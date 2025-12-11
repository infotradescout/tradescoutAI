export type DeviceType = "desktop" | "mobile";

export type ShellEvent =
  | {
      type: "community_shell_nav_click";
      fromPath: string;
      toPath: string;
      deviceType: DeviceType;
      hasUnreadNotifications: boolean;
    }
  | {
      type: "community_shell_load";
      path: string;
      deviceType: DeviceType;
      hasUnreadNotifications: boolean;
      locationSet: boolean;
    };

function getDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

export async function trackShellEvent(event: ShellEvent) {
  if (typeof window === "undefined") return;

  const payload = {
    ...event,
    ts: Date.now(),
  };

  // Optional: completely skip shell analytics in dev to reduce noise
  // if (import.meta.env.DEV) return;

  try {
    const res = await fetch("/api/analytics/shell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
      keepalive: true,
    });

    // Not logged in – treat as a no-op, don't surface errors
    if (res.status === 401) {
      return;
    }

    // Only warn on real failures, and only in production
    if (!res.ok && import.meta.env.PROD) {
      console.warn("Shell analytics failed", res.status);
    }
  } catch (err) {
    // Never let analytics break UX; optionally log in production only
    if (import.meta.env.PROD) {
      console.error("Shell analytics error", err);
    }
  }
}

export { getDeviceType };
