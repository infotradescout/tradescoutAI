import { QueryClient } from "@tanstack/react-query";

// Get API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const apiRequest = async (
  method: string = "GET",
  endpoint: string = "",
  data?: any
): Promise<any> => {
  try {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login on unauthorized
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }

      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // If we can't parse the error response, use the default message
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
};

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
        // Don't retry on 4xx errors
        if (error?.message?.includes('401') || error?.message?.includes('403') || error?.message?.includes('404')) {
          return false;
        }

        // Retry up to 1 time for other errors (reduced for performance)
        return failureCount < 1;
      },
      staleTime: 60000, // Consider data stale after 60 seconds
      gcTime: 300000, // Keep in cache for 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1, // Retry mutations once
    },
  },
});

// Listen for low memory events and clear cache
window.addEventListener('lowMemory', () => {
  queryClient.clear();
  console.log('Query cache cleared due to low memory');
});

export { apiRequest };