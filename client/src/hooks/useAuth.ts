import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  // Backend exposes a boolean admin flag; use this for all admin gating
  isAdmin?: boolean;
  role?: string;
  roles?: string[];
  badges?: string[];
  preferences?: any;
  profileImageUrl?: string;
  emailVerified?: boolean;
  addressVerified?: boolean;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
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
        if (response.status === 401) {
          return null; // User not authenticated
        }
        throw new Error(`Auth request failed: ${response.status}`);
      }
      return response.json();
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