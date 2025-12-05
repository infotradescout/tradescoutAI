import React, { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PageLoadingSpinner } from '@/components/LoadingSpinner';
import { AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallback?: React.ReactNode;
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
  fallback
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Determine if user has required role
  const hasAccess = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (requiredRoles.length === 0) return true; // No role requirement, just need auth
    return requiredRoles.includes(user.role);
  }, [user, isAuthenticated, requiredRoles]);

  // Loading state
  if (isLoading) {
    return fallback || <PageLoadingSpinner message="Verifying permissions..." />;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-navy-800 border-navy-700 p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          </div>
          <p className="text-gray-300 mb-6">
            You must be logged in to access this page.
          </p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
          >
            Go to Login
          </a>
        </Card>
      </div>
    );
  }

  // Authenticated but insufficient permissions
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-navy-800 border-navy-700 p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <h1 className="text-2xl font-bold text-white">Forbidden</h1>
          </div>
          <p className="text-gray-300 mb-2">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Your role: <strong>{user.role}</strong>
            {requiredRoles.length > 0 && (
              <>
                <br />
                Required roles: <strong>{requiredRoles.join(', ')}</strong>
              </>
            )}
          </p>
          <a
            href="/dashboard"
            className="inline-block px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
          >
            Go to Dashboard
          </a>
        </Card>
      </div>
    );
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
    if (requiredRoles.length === 0) return true;
    return requiredRoles.includes(user.role);
  }, [user, isAuthenticated, requiredRoles]);

  return {
    canAccess,
    user,
    isAuthenticated,
  };
}
