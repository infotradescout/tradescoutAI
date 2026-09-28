import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { buildApiUrl } from "@/lib/apiBaseUrl";
import { readAuthSessionUser, shouldRetryAuthSessionRead } from "@/lib/authSessionRead";

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
    const user = await readAuthSessionUser(buildApiUrl("/api/auth/user"));
    return user ? sanitizeAuthUserAuthority(user as User) : null;
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
    retry: shouldRetryAuthSessionRead,
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
    // A rejected probe preserves the query's last known user; only explicit
    // guest evidence clears it. Loading remains bounded by the probe deadline.
    // Cached presentation never bypasses server-side authorization.
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
