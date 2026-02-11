import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

export interface User {
  [key: string]: any;
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  // Backend exposes a boolean admin flag; use this for all admin gating
  isAdmin?: boolean;
  role?: any;
  activeRole?: any;
  roles?: any[];
  badges?: string[];
  preferences?: any;
  profileImageUrl?: string;
  avatar?: string;
  username?: string;
  emailVerified?: boolean;
  addressVerified?: boolean;
  onboardingCompleted?: boolean;
  verificationStatus?: string;
  customThemeColors?: string;
  themePreference?: string;
  stats?: any;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  // Canonical machine-readable location fields
  stateCode?: string;
  countyFips?: string;
  countyId?: string;
  countyName?: string;
  // Some parts of the UI still reference legacy location field names
  zip?: string;
  latitude?: number;
  longitude?: number;
  county?: string;
  // Profile normalization & gating
  profileVersion?: number;
  locationCommitted?: boolean;
  // Optional intent/preference hints
  lastIntent?: string;
  isImpersonating?: boolean;
  originalRole?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  communityFirst?: boolean;
}

export function useAuth() {
  const authQuery = useCallback(async () => {
    try {
      const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const authUrl = `${apiBaseUrl}/api/auth/user`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(authUrl, {
        credentials: "include",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      clearTimeout(timeoutId);

      // 401 is not an error: it means guest / not signed in.
      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        // Fail-soft: auth should never block the UI.
        console.warn(`Auth request returned ${response.status}; treating as guest`);
        return null;
      }

      const payload: any = await response.json().catch(() => null);

      // Fail-soft shape (preferred): { authenticated: boolean, user?: User }
      if (payload && typeof payload === "object" && "authenticated" in payload) {
        if (payload.authenticated === true && payload.user) {
          return payload.user as User;
        }
        return null;
      }

      // Legacy shape: user object or null
      if (!payload) return null;
      return payload as User;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.warn("Auth request timed out");
          return null;
        }
        if (error.message.includes("fetch") || error.message.includes("Failed to fetch")) {
          console.warn("Network error during auth request:", error.message);
          return null;
        }
      }
      console.warn("Auth request error; treating as guest");
      return null;
    }
  }, []);

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: authQuery,
    retry: (failureCount, error) => {
      // Only retry on network errors, not auth failures
      if (failureCount < 2 && error?.message?.includes("fetch")) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
    refetchOnWindowFocus: false,
    // Auth state can change outside React Query awareness (login/logout, OAuth redirects).
    // Always re-check on mount so ProtectedRoute and RootLanding don't get stuck in "guest".
    refetchOnMount: "always",
    refetchInterval: false,
  });

  return {
    user: user || null,
    isLoading,
    isAuthenticated: !!user,
    error,
    refetch,
  };
}

export async function logoutUser(): Promise<void> {
  const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const logoutUrl = `${apiBaseUrl}/api/auth/logout`;

  const doRequest = async (method: "POST" | "GET") => {
    const response = await fetch(logoutUrl, {
      method,
      credentials: "include",
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    });
    return response;
  };

  try {
    let response = await doRequest("POST");

    if (response.status === 405) {
      response = await doRequest("GET");
    }

    if (!response.ok) {
      throw new Error(`Logout failed (${response.status})`);
    }
  } catch (error) {
    console.error("Logout failed:", error);
  } finally {
    // Fail-soft: always send the user home and clear SPA state
    window.location.href = "/";
  }
}

export function useLogout() {
  return async () => {
    await logoutUser();
  };
}
