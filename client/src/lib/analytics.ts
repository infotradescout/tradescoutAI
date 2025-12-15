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
    }
  | {
      type: "community_shell_scaffold_click";
      section: string;
      deviceType: DeviceType;
      hasUnreadNotifications: boolean;
    }
  | {
      // Generic catch-all (used by /api/scout logScoutInsight)
      type: "scout_query";
      payload: unknown;
    };

export function getDeviceType(): DeviceType {
  if (typeof window === "undefined") {
    return "desktop";
  }
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

export async function trackShellEvent(event: ShellEvent) {
  // In development, skip hitting the server entirely.
  // This keeps your DevTools clean and avoids noise while you build.
  if (import.meta.env.DEV) {
    return;
  }

  try {
    const res = await fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    // In production, only warn on "real" failures.
    if (!res.ok && res.status !== 401 && import.meta.env.PROD) {
      console.warn("Shell analytics failed", res.status);
    }
  } catch (err) {
    if (import.meta.env.PROD) {
      console.error("Shell analytics error", err);
    }
  }
}
