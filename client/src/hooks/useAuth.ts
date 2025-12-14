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
  // Some parts of the UI still reference legacy location field names
  zip?: string;
  latitude?: number;
  longitude?: number;
  county?: string;
  isImpersonating?: boolean;
  originalRole?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export function useAuth() {
  const authQuery = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('/api/auth/user', {
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorPayload: any = null;
        try {
          errorPayload = await response.json();
        } catch {
          // ignore
        }
        if (errorPayload) {
          console.error('Auth request failed payload:', errorPayload);
        }
        throw new Error(`Auth request failed: ${response.status}`);
      }

      const payload: any = await response.json().catch(() => null);

      // Fail-soft shape (preferred): { authenticated: boolean, user?: User }
      if (payload && typeof payload === 'object' && 'authenticated' in payload) {
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
        if (error.name === 'AbortError') {
          console.warn('Auth request timed out');
          return null;
        }
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          console.warn('Network error during auth request:', error.message);
          return null;
        }
      }
      console.error('Auth request error:', error);
      return null;
    }
  }, []);

  const { data: user, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: authQuery,
    retry: (failureCount, error) => {
      // Only retry on network errors, not auth failures
      if (failureCount < 2 && error?.message?.includes('fetch')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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

export function useLogout() {
  return async () => {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    
    if (response.ok) {
      // Reload the page to clear all application state
      window.location.reload();
    } else {
      throw new Error('Logout failed');
    }
  };
}