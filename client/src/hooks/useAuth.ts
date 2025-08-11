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
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 401) {
          return null; // User not authenticated
        }
        throw new Error('Failed to fetch user');
      }
      return response.json();
    },
    retry: false,
  });

  return {
    user,
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