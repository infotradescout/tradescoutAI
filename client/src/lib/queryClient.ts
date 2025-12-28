import { QueryClient } from "@tanstack/react-query";

// Get API URL from environment variables  
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Enhanced API request function with better error handling
export async function apiRequest(method: string, url: string, data?: any): Promise<any>;
export async function apiRequest(url: string, options?: { method?: string; body?: any; data?: any } | any): Promise<any>;
export async function apiRequest(methodOrUrl: string, urlOrData?: string | Record<string, any>, data?: any) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    // Normalize arguments to support both apiRequest(method, url, data) and apiRequest(url, options)
    let method = 'GET';
    let url = '';
    let payload: any;

    if (typeof urlOrData === 'string') {
      method = methodOrUrl?.toUpperCase?.() || 'GET';
      url = urlOrData;
      payload = data;
    } else {
      url = methodOrUrl;
      method = (urlOrData as any)?.method?.toUpperCase?.() || 'GET';
      payload = (urlOrData as any)?.body ?? (urlOrData as any)?.data;

      // If no explicit body provided but options look like payload, send it for non-GET
      if (payload === undefined && urlOrData && typeof urlOrData === 'object' && method !== 'GET') {
        payload = urlOrData;
      }
    }

    const config: RequestInit = {
      method,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
      config.body = JSON.stringify(payload);
    }

    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, config);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed with status ${response.status}`;
      let errorCode: string | undefined;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
        errorCode = errorJson.code;
      } catch {
        // Use the raw text as error message
        errorMessage = errorText || errorMessage;
      }

      if (response.status === 403 && errorCode === "ONBOARDING_REQUIRED") {
        if (typeof window !== "undefined") {
          window.location.href = "/onboarding/profile";
        }
        throw new Error("Please finish updating your profile before continuing.");
      }

      throw new Error(errorMessage);
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
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error('Network error - please check your connection');
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
        const fullUrl = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ""}${url}`;
        const response = await fetch(fullUrl, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          let message = `Request failed with status ${response.status}`;
          let code: string | undefined;
          try {
            const errorJson = await response.json();
            message = errorJson?.message || message;
            code = errorJson?.code;
          } catch {
            // fall through with default message
          }

          if (response.status === 403 && code === "ONBOARDING_REQUIRED") {
            if (typeof window !== "undefined") {
              window.location.href = "/onboarding/profile";
            }
            throw new Error("Please finish updating your profile before continuing.");
          }

          throw new Error(message);
        }

        return response.json();
      },
      retry: (failureCount, error: any) => {
        // Only retry on network errors
        if (failureCount < 2 && error?.message?.includes('fetch')) {
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
        if (failureCount < 1 && error?.message?.includes('fetch')) {
          return true;
        }
        return false;
      },
      retryDelay: 2000,
    },
  },
});

// Listen for low memory events and clear cache
window.addEventListener('lowMemory', () => {
  queryClient.clear();
  console.log('Query cache cleared due to low memory');
});