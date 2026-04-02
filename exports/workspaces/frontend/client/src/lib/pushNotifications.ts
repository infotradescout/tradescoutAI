import { apiRequest } from "@/lib/queryClient";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotifications() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const config = await apiRequest("GET", "/api/public/config");
    const vapidPublicKey = (config as any)?.vapidPublicKey as string | undefined;
    if (!vapidPublicKey) return;

    const registration = await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      return existing;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const json = subscription.toJSON();

    await apiRequest("POST", "/api/notifications/push-subscription", {
      endpoint: json.endpoint!,
      keys: json.keys as { p256dh: string; auth: string },
      userAgent: navigator.userAgent,
    });

    return subscription;
  } catch (err) {
    console.error("Failed to register push notifications", err);
    return undefined;
  }
}

export async function unregisterPushSubscription() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const json = subscription.toJSON();

    await apiRequest("DELETE", "/api/notifications/push-subscription?endpoint=" + encodeURIComponent(json.endpoint!));
    await subscription.unsubscribe();
  } catch (err) {
    console.error("Failed to unregister push subscription", err);
  }
}
