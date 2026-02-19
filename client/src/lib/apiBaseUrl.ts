const configuredApiBaseUrl = String(import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/$/, "");

const forceCrossOriginApi =
  String(import.meta.env.VITE_FORCE_CROSS_ORIGIN_API || "")
    .trim()
    .toLowerCase() === "true";

export function getApiBaseUrl(): string {
  if (!configuredApiBaseUrl) return "";

  if (typeof window === "undefined") {
    return configuredApiBaseUrl;
  }

  try {
    const configuredOrigin = new URL(configuredApiBaseUrl).origin;
    if (configuredOrigin === window.location.origin) {
      return "";
    }
    if (forceCrossOriginApi) {
      return configuredApiBaseUrl;
    }
    return "";
  } catch {
    return "";
  }
}

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${getApiBaseUrl()}${path}`;
}
