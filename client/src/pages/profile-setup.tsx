import { Redirect } from "wouter";

/**
 * Legacy module kept for older lazy-import references. The route itself is
 * owned by the universal outcome onboarding screen in AppRoutes.
 */
export default function ProfileSetup() {
  return <Redirect to="/onboarding" replace />;
}
