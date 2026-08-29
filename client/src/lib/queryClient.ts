import { QueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { registerQueryCacheLowMemoryLifecycle } from "@/lib/browserLifecycle";

export class ApiError extends Error {
  code?: string;
  status?: number;
  errorId?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  constructor(
    message: string,
    opts?: {
      code?: string;
      status?: number;
      requestId?: string;
      errorId?: string;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "ApiError";
    this.code = opts?.code;
    this.status = opts?.status;
    this.requestId = opts?.requestId;
    this.errorId = opts?.errorId;
    this.details = opts?.details;
  }
}

// Enhanced API request function with better error handling.
// Contract: resolves to already-parsed JSON (or null/text). Callers must NOT call `.json()`.
export async function apiRequest(method: string, url: string, data?: any): Promise<any>;
export async function apiRequest(
  url: string,
  options?:
    | {
        method?: string;
        body?: any;
        data?: any;
        timeoutMs?: number;
        signal?: AbortSignal;
        headers?: Record<string, string>;
      }
    | any
): Promise<any>;
export async function apiRequest(
  methodOrUrl: string,
  urlOrData?: string | Record<string, any>,
  data?: any
) {
  try {
    const controller = new AbortController();
    const optionsTimeoutMs =
      typeof urlOrData === "object" && urlOrData !== null && "timeoutMs" in urlOrData
        ? Number((urlOrData as any).timeoutMs)
        : NaN;
    const timeoutMs = Number.isFinite(optionsTimeoutMs) ? Math.max(0, optionsTimeoutMs) : 15000;

    // Allow callers to pass their own AbortSignal (e.g., when using react-query cancellation).
    const externalSignal =
      typeof urlOrData === "object" && urlOrData !== null
        ? ((urlOrData as any).signal as any)
        : null;
    if (externalSignal && typeof externalSignal.addEventListener === "function") {
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const timeoutId =
      timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : (null as any);

    // Normalize arguments to support both apiRequest(method, url, data) and apiRequest(url, options)
    let method = "GET";
    let url = "";
    let payload: any;

    if (typeof urlOrData === "string") {
      method = methodOrUrl?.toUpperCase?.() || "GET";
      url = urlOrData;
      payload = data;
    } else {
      url = methodOrUrl;
      method = (urlOrData as any)?.method?.toUpperCase?.() || "GET";
      payload = (urlOrData as any)?.body ?? (urlOrData as any)?.data;

      // If no explicit body provided but options look like payload, send it for non-GET
      if (payload === undefined && urlOrData && typeof urlOrData === "object" && method !== "GET") {
        payload = urlOrData;
      }
    }

    const config: RequestInit = {
      method,
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    };

    const extraHeaders =
      typeof urlOrData === "object" && urlOrData !== null && (urlOrData as any).headers
        ? ((urlOrData as any).headers as Record<string, string>)
        : null;
    if (extraHeaders && typeof extraHeaders === "object") {
      config.headers = { ...(config.headers as any), ...extraHeaders };
    }

    if (
      payload &&
      (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE")
    ) {
      // Allow raw bodies for large/admin endpoints (e.g. text/csv imports) without hitting JSON limits.
      if (typeof payload === "string") {
        config.body = payload;
        const headers = config.headers as Record<string, string>;
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "text/plain; charset=utf-8";
        }
      } else if (typeof FormData !== "undefined" && payload instanceof FormData) {
        config.body = payload as any;
        // Let the browser set multipart boundaries.
        const headers = config.headers as Record<string, string>;
        if (headers["Content-Type"]) {
          delete headers["Content-Type"];
        }
      } else {
        config.body = JSON.stringify(payload);
        const headers = config.headers as Record<string, string>;
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
    }

    const fullUrl = buildApiUrl(url);
    const response = await fetch(fullUrl, config);
    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed with status ${response.status}`;
      let errorCode: string | undefined;
      let requestId: string | undefined = response.headers.get("X-Request-Id") || undefined;
      let errorId: string | undefined;
      let errorDetails: Record<string, unknown> | undefined;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && typeof errorJson === "object") errorDetails = errorJson;
        errorMessage = errorJson.message || errorMessage;
        errorCode = errorJson.code;
        errorId =
          typeof errorJson.errorId === "string" && errorJson.errorId.trim()
            ? errorJson.errorId.trim()
            : undefined;
        requestId =
          typeof errorJson.requestId === "string" && errorJson.requestId.trim()
            ? errorJson.requestId.trim()
            : requestId;
      } catch {
        // Use the raw text as error message
        errorMessage = errorText || errorMessage;
      }

      if (response.status === 403 && errorCode === "ONBOARDING_REQUIRED") {
        // Never hard-redirect from a low-level API helper; background fetches can
        // trip onboarding gating and yank users away from what they were doing.
        throw new ApiError("Please finish updating your profile before continuing.", {
          code: errorCode,
          status: response.status,
          requestId,
          errorId,
          details: errorDetails,
        });
      }

      throw new ApiError(errorMessage, {
        code: errorCode,
        status: response.status,
        requestId,
        errorId,
        details: errorDetails,
      });
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      if (error.message.includes("fetch") || error.message.includes("Failed to fetch")) {
        throw new Error("Network error - please check your connection");
      }
    }
    throw error;
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [endpoint, ...params] = queryKey as [string, ...any[]];

        // Handle parameterized queries
        let url = endpoint;
        if (params.length > 0) {
          const searchParams = new URLSearchParams();
          params.forEach((param, index) => {
            if (param !== undefined && param !== null) {
              searchParams.append(`param${index}`, String(param));
            }
          });
          url += `?${searchParams.toString()}`;
        }

        // Make raw fetch call and return Response for React Query to handle
        const fullUrl = buildApiUrl(url);
        const response = await fetch(fullUrl, {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          let message = `Request failed with status ${response.status}`;
          let code: string | undefined;
          let requestId: string | undefined = response.headers.get("X-Request-Id") || undefined;
          let errorId: string | undefined;
          try {
            const errorJson = await response.json();
            message = errorJson?.message || message;
            code = errorJson?.code;
            errorId =
              typeof errorJson?.errorId === "string" && errorJson.errorId.trim()
                ? errorJson.errorId.trim()
                : undefined;
            requestId =
              typeof errorJson?.requestId === "string" && errorJson.requestId.trim()
                ? errorJson.requestId.trim()
                : requestId;
          } catch {
            // fall through with default message
          }

          if (response.status === 403 && code === "ONBOARDING_REQUIRED") {
            // Don't hard-redirect from queryFn (background queries should not hijack navigation).
            throw new ApiError("Please finish updating your profile before continuing.", {
              code,
              status: response.status,
              requestId,
              errorId,
            });
          }

          throw new ApiError(message, { code, status: response.status, requestId, errorId });
        }

        return response.json();
      },
      retry: (failureCount, error: any) => {
        // Only retry on network errors
        if (failureCount < 2 && error?.message?.includes("fetch")) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 60_000, // 1 minute
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Only retry mutations on network errors
        if (failureCount < 1 && error?.message?.includes("fetch")) {
          return true;
        }
        return false;
      },
      retryDelay: 2000,
    },
  },
});

registerQueryCacheLowMemoryLifecycle(queryClient);
