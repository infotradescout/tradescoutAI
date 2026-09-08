import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { buildApiUrl } from "@/lib/apiBaseUrl";

export interface VerificationBypassMetadata {
  active: boolean;
  privileged?: boolean;
  reason?:
    | "none"
    | "role"
    | "admin_flag"
    | "direct_connect_demo_mode"
    | "manual_direct_connect_override";
  matchedRoles?: string[];
  directConnectDemoMode?: boolean;
}

const VERIFICATION_BYPASS_REASONS = new Set<VerificationBypassMetadata["reason"]>([
  "none",
  "role",
  "admin_flag",
  "direct_connect_demo_mode",
  "manual_direct_connect_override",
]);

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
  verificationBypass?: VerificationBypassMetadata;
}

export function sanitizeAuthUserAuthority(user: User): User {
  const bypass = user?.verificationBypass;
  if (!bypass || VERIFICATION_BYPASS_REASONS.has(bypass.reason)) {
    return user;
  }

  // Ignore obsolete or unknown authority reasons from stale cached responses.
  // The current server contract never grants authority from an email value.
  const { verificationBypass: _ignored, ...safeUser } = user;
  return safeUser as User;
}

export function useAuth() {
  const authQuery = useCallback(async () => {
    try {
      const authUrl = buildApiUrl("/api/auth/user");
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
      // 404 can happen on a misrouted/cached apex host; fail soft so the app renders
      // instead of trapping users on the boot spinner.
      if (response.status === 401 || response.status === 404) {
        return null;
      }

      if (!response.ok) {
        // Important: do NOT treat non-401 responses as "guest".
        // Doing so makes the app think a signed-in user is logged out and breaks navigation.
        // Instead, throw so React Query preserves the last known-good user payload.
        const message = `Auth request failed (${response.status})`;
        console.warn(message);
        throw new Error(message);
      }

      const payload: any = await response.json().catch(() => null);

      // Fail-soft shape (preferred): { authenticated: boolean, user?: User }
      if (payload && typeof payload === "object" && "authenticated" in payload) {
        if (payload.authenticated === true && payload.user) {
          return sanitizeAuthUserAuthority(payload.user as User);
        }
        return null;
      }

      // Legacy shape: user object or null
      if (!payload) return null;
      return sanitizeAuthUserAuthority(payload as User);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.warn("Auth request timed out");
          throw error;
        }
        if (error.message.includes("fetch") || error.message.includes("Failed to fetch")) {
          console.warn("Network error during auth request:", error.message);
          throw error;
        }
      }
      console.warn("Auth request error");
      throw error instanceof Error ? error : new Error("Auth request failed");
    }
  }, []);

  const {
    data: user,
    isLoading,
    isFetching,
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
    // We use staleTime and gcTime to manage caching.
    refetchOnMount: true,
    refetchInterval: false,
  });

  return {
    user: user || null,
    // Treat active auth revalidation as loading, but never pin the whole app
    // behind the spinner after an auth error. A failed auth probe should degrade
    // to a guest session so users can still load the site.
    isLoading: isLoading || isFetching,
    isAuthenticated: !!user,
    error,
    refetch,
  };
}

export async function logoutUser(): Promise<void> {
  const logoutUrl = buildApiUrl("/api/auth/logout");

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
