import { useQuery } from "@tanstack/react-query";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'homeowner' | 'contractor_user' | 'realtor' | 'car_salesman' | 'accelerator_member' | 'moderator' | 'ops_admin' | 'head_admin';
  profileImageUrl?: string;
  emailVerified: boolean;
  addressVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/user', {
          credentials: 'include',
        });
        if (!response.ok) {
          if (response.status === 401) {
            return null; // User not authenticated
          }
          throw new Error(`Auth request failed: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        console.error('Auth request error:', error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
          // Network error
          return null;
        }
        throw error;
      }
    },
    retry: 1,
    retryDelay: 2000,
    staleTime: 10 * 60 * 1000, // 10 minutes - reduce polling
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