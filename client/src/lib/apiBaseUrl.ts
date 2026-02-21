const configuredApiBaseUrl = String(import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/$/, "");

const forceCrossOriginApi =
  String(import.meta.env.VITE_FORCE_CROSS_ORIGIN_API || "")
    .trim()
    .toLowerCase() === "true";

function isPrimaryTradeScoutHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "thetradescout.com" || normalized === "www.thetradescout.com";
}

export function getApiBaseUrl(): string {
  if (!configuredApiBaseUrl) return "";

  if (typeof window === "undefined") {
    return configuredApiBaseUrl;
  }

  try {
    const configuredOrigin = new URL(configuredApiBaseUrl).origin;
    const configuredHost = new URL(configuredApiBaseUrl).hostname;
    const currentHost = window.location.hostname;

    if (configuredOrigin === window.location.origin) {
      return "";
    }

    // Keep auth/session same-origin between apex and www.
    if (isPrimaryTradeScoutHost(configuredHost) && isPrimaryTradeScoutHost(currentHost)) {
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
