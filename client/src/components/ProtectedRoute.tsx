import React, { useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { PageLoadingSpinner } from '@/components/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallback?: React.ReactNode;
  /** If true, require user.isAdmin === true regardless of string roles */
  adminOnly?: boolean;
}

/**
 * ProtectedRoute wraps components that require authentication and specific roles.
 * 
 * Requires at least one role match (OR logic)
 * 
 * @example
 * <ProtectedRoute requiredRoles={['super_admin', 'head_admin']}>
 *   <PromptAdminPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({ 
  children, 
  requiredRoles = [],
  fallback,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Determine if user has required role
  const hasAccess = useMemo(() => {
    if (!isAuthenticated || !user) return false;

    // Unified admin model: boolean flag from backend
    const isAdmin = user.isAdmin === true;

    // Admin-only routes: rely solely on isAdmin flag
    if (adminOnly) return isAdmin;

    // No specific role requirement, just needs authentication
    if (requiredRoles.length === 0) return true;

    // Backwards-compatible role check for non-admin features;
    // also let admins bypass string role checks.
    if (isAdmin) return true;
    return requiredRoles.includes(user.role);
  }, [user, isAuthenticated, requiredRoles, adminOnly]);

  // Loading state
  if (isLoading) {
    return fallback || <PageLoadingSpinner message="Verifying permissions..." />;
  }

  // Not authenticated
  if (!isAuthenticated) {
    setLocation('/login');
    return null;
  }

  // Authenticated but insufficient permissions
  if (!hasAccess) {
    setLocation('/unauthorized');
    return null;
  }

  // Has access
  return <>{children}</>;
}

/**
 * useCanAccess - Hook to check if current user can access a resource
 * @param requiredRoles - Array of roles that can access the resource
 * @returns Object with canAccess boolean and user data
 */
export function useCanAccess(requiredRoles: string[] = []) {
  const { user, isAuthenticated } = useAuth();

  const canAccess = useMemo(() => {
    if (!isAuthenticated || !user) return false;

    const isAdmin = user.isAdmin === true;

    if (requiredRoles.length === 0) return true;

    // Admins can access anything guarded by string roles
    if (isAdmin) return true;
    return requiredRoles.includes(user.role);
  }, [user, isAuthenticated, requiredRoles]);

  return {
    canAccess,
    user,
    isAuthenticated,
  };
}
