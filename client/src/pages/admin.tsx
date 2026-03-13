import React, { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";
import { SuperAdminOSLayout } from "@/admin/SuperAdminOSLayout";
import { resolveAdminToolByLocation, type AdminRole } from "@/admin/adminTools";

type AdminHealthResponse = {
  ok: boolean;
  userId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
};

export default function AdminShell() {
  const { data, isLoading, error } = useQuery<AdminHealthResponse>({
    queryKey: ["/api/admin/health"],
  });

  if (isLoading) {
    return <PageLoadingSpinner message="Verifying admin access..." />;
  }

  if (error || !data?.ok) {
    return (
      <div className="bg-background flex items-center justify-center py-24 px-4">
        <Card className="max-w-md w-full border-red-500/40 bg-card">
          <CardHeader>
            <CardTitle className="text-red-300">Admin access required</CardTitle>
            <CardDescription className="text-white/70">
              This portal is restricted to platform administrators. Your current session does not
              have access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/60">
              If you believe this is an error, check your assigned role or contact the platform
              owner.
            </p>
            <div className="flex justify-between items-center text-xs text-white/60">
              <span>Requested: /admin</span>
              <span>Role: {data?.role || "unknown"}</span>
            </div>
            <div className="flex gap-2 justify-end">
              <Link href="/">
                <Button variant="outline" size="sm">
                  Return home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <SuperAdminOSLayout>
      <AdminContentRouter
        role={((data?.role as AdminRole) || "ops_admin") as AdminRole}
        isSuperAdmin={Boolean(data?.isSuperAdmin)}
      />
    </SuperAdminOSLayout>
  );
}

function AdminContentRouter({ role, isSuperAdmin }: { role: AdminRole; isSuperAdmin: boolean }) {
  const [location] = useLocation();
  const pathname = (location || "/admin").split(/[?#]/, 1)[0] || "/admin";

  // Canonical Admin OS landing: super admins go to the live system feed, other admins go to users.
  if (pathname === "/admin") {
    const AdminLiveStream = React.lazy(() => import("@/pages/admin-live-stream"));
    const AdminUsers = React.lazy(() => import("@/pages/admin-users"));
    return (
      <Suspense fallback={<PageLoadingSpinner message="Loading admin tools..." />}>
        {isSuperAdmin ? <AdminLiveStream /> : <AdminUsers />}
      </Suspense>
    );
  }

  const resolved = resolveAdminToolByLocation(pathname || "/admin", role, isSuperAdmin);
  if (!resolved.tool) return <UnknownAdminRoute />;
  if (!resolved.allowed) return <AdminAccessDenied />;

  return (
    <Suspense fallback={<PageLoadingSpinner message="Loading admin tool..." />}>
      {resolved.tool.render()}
    </Suspense>
  );
}

function AdminAccessDenied() {
  return (
    <Card className="bg-black/30 border-white/10">
      <CardHeader>
        <CardTitle className="text-sm text-white">Insufficient role</CardTitle>
        <CardDescription className="text-xs text-white/60">
          This admin tool is restricted to super admins.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 flex justify-end">
        <Link href="/admin">
          <Button size="sm" variant="outline">
            Back to admin home
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function UnknownAdminRoute() {
  const [location] = useLocation();

  return (
    <Card className="bg-black/30 border-white/10">
      <CardHeader>
        <CardTitle className="text-sm text-white">Unknown admin tool</CardTitle>
        <CardDescription className="text-xs text-white/60">
          This admin path is not wired into the Admin OS yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 flex justify-between items-center text-xs text-white/60">
        <span>Requested: {location}</span>
        <Link href="/admin">
          <Button size="sm" variant="outline">
            Go to Admin dashboard
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
