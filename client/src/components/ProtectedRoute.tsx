import React, { useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { SkeletonBlock } from "@/components/ui/states";
import {
  hasAdminUiAccess,
  isSuperAdminLike as isSuperAdminRoleLike,
} from "@/lib/roleChecks";
import {
  buildAuthEntryRoute,
  getCurrentInternalPath,
  getOnboardingEntryRoute,
  isOnboardingExemptPath,
  isSafeNextPath,
  userNeedsOnboarding,
} from "@/lib/postOnboardingRoute";
import { isOutcomeOnboardingClaimContinuationPath } from "@/lib/outcomeOnboardingClaimContinuation";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallback?: React.ReactNode;
  /** If true, require canonical admin UI access. */
  adminOnly?: boolean;
}

function isAdminLikeUser(user: any): boolean {
  return hasAdminUiAccess(user);
}

/**
 * ProtectedRoute wraps components that require authentication and specific roles.
 *
 * Requires at least one role match (OR logic)
 *
 * @example
 * <ProtectedRoute requiredRoles={['super_admin']}>
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
  const [location, setLocation] = useLocation();

  // Determine if user has required role
  const hasAccess = useMemo(() => {
    if (!isAuthenticated || !user) return false;

    // Unified admin model: boolean flag from backend
    const isAdmin = isAdminLikeUser(user);

    // Admin-only routes: rely solely on isAdmin flag
    if (adminOnly) return isAdmin;

    // No specific role requirement, just needs authentication
    if (requiredRoles.length === 0) return true;

    // Backwards-compatible role check for non-admin features;
    // also let admins bypass string role checks.
    if (isAdmin) return true;
    return requiredRoles.includes(user.role);
  }, [user, isAuthenticated, requiredRoles, adminOnly]);

  // Handle redirects in useEffect to avoid setState during render
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Preserve the user's intended destination so auth can return them correctly.
      setLocation(buildAuthEntryRoute({ mode: "signin", next: getCurrentInternalPath(location) }));
      return;
    }

    // Check profile normalization needs
    const isAdmin = isAdminLikeUser(user);
    const role = (user as any)?.role as string | undefined;
    const isSuperAdminLike = isSuperAdminRoleLike(role);
    const needsOnboarding = userNeedsOnboarding(user);
    const pathOnly = (location || "/").split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";

    const isSetupRoute = isOnboardingExemptPath(pathOnly);
    const isScopedClaimContinuation = isOutcomeOnboardingClaimContinuationPath(
      getCurrentInternalPath(location)
    );

    if (
      !isAdmin &&
      !isSuperAdminLike &&
      user &&
      needsOnboarding &&
      !isSetupRoute &&
      !isScopedClaimContinuation
    ) {
      const requestedPath = getCurrentInternalPath(location);
      const entryRoute = getOnboardingEntryRoute(user);
      setLocation(
        isSafeNextPath(requestedPath)
          ? `${entryRoute}?next=${encodeURIComponent(requestedPath)}`
          : entryRoute
      );
      return;
    }

    // Check access permissions
    if (!hasAccess) {
      setLocation("/unauthorized");
    }
  }, [isLoading, isAuthenticated, user, hasAccess, location, setLocation]);

  // Loading state
  if (isLoading) {
    return (
      fallback || (
        <div className="min-h-[40vh] flex items-center justify-center">
          <SkeletonBlock className="h-6 w-40" />
        </div>
      )
    );
  }

  // Not authenticated or no access - show nothing while redirecting
  if (!isAuthenticated || !hasAccess) {
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

    const isAdmin = isAdminLikeUser(user);

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
