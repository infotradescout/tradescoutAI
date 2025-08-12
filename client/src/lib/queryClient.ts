import { QueryClient } from "@tanstack/react-query";

// Get API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Enhanced API request function with better error handling
export async function apiRequest(method: string, url: string, data?: any) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const config: RequestInit = {
      method,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed with status ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        // Use the raw text as error message
        errorMessage = errorText || errorMessage;
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

        return apiRequest("GET", url);
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