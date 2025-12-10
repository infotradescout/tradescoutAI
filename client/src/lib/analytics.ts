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

export function trackShellEvent(event: ShellEvent) {
  if (typeof window === "undefined") return;

  const payload = {
    ...event,
    ts: Date.now(),
  };

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/analytics/shell",
        new Blob([JSON.stringify(payload)], { type: "application/json" }),
      );
    } else {
      void fetch("/api/analytics/shell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  } catch {
    // Fail silently; analytics must never break UX.
  }
}

export { getDeviceType };
