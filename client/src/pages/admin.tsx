import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";
import { SuperAdminOSLayout } from "@/admin/SuperAdminOSLayout";
import { AdminHome } from "@/admin/AdminHome";
import { AdminEmptyState, AdminWorkspace } from "@/admin/AdminWorkspace";
import { AdminToolSurface } from "@/admin/AdminToolSurface";
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
      <div className="flex min-h-[var(--app-height)] items-center justify-center bg-[#08090a] px-4 py-20">
        <div className="w-full max-w-lg border-y border-red-400/20 bg-red-400/[0.035] px-5 py-10 text-center">
          <h1 className="text-xl font-semibold text-red-100">Admin access required</h1>
          <p className="mt-3 text-sm leading-6 text-red-100/65">
            This workspace is restricted to platform administrators. The current session does not
            have admin access.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/">
              <Button variant="outline" className="border-white/15 bg-transparent text-white">
                Return home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const role = ((data?.role as AdminRole) || "ops_admin") as AdminRole;
  const isSuperAdmin = Boolean(data?.isSuperAdmin);

  return (
    <SuperAdminOSLayout role={role} isSuperAdmin={isSuperAdmin}>
      <AdminContentRouter role={role} isSuperAdmin={isSuperAdmin} />
    </SuperAdminOSLayout>
  );
}

function AdminContentRouter({ role, isSuperAdmin }: { role: AdminRole; isSuperAdmin: boolean }) {
  const [location] = useLocation();
  const pathname = (location || "/admin").split(/[?#]/, 1)[0] || "/admin";

  if (pathname === "/admin") {
    return <AdminHome role={role} isSuperAdmin={isSuperAdmin} />;
  }

  const resolved = resolveAdminToolByLocation(pathname, role, isSuperAdmin);
  const silentlyFellBackToHome = resolved.tool?.path === "/admin" && pathname !== "/admin";
  if (!resolved.tool || silentlyFellBackToHome) return <UnknownAdminRoute requestedPath={pathname} />;
  if (!resolved.allowed) return <AdminAccessDenied />;

  return (
    <Suspense fallback={<PageLoadingSpinner message="Loading admin tool..." />}>
      <AdminToolSurface tool={resolved.tool}>{resolved.tool.render()}</AdminToolSurface>
    </Suspense>
  );
}

function AdminAccessDenied() {
  return (
    <AdminWorkspace>
      <AdminEmptyState
        title="This workspace requires a higher admin role"
        description="Your current role can see the Admin OS, but it cannot open this operating surface."
        action={
          <Link href="/admin">
            <Button variant="outline" className="border-white/15 bg-transparent text-white">
              Return to Admin Home
            </Button>
          </Link>
        }
      />
    </AdminWorkspace>
  );
}

function UnknownAdminRoute({ requestedPath }: { requestedPath: string }) {
  return (
    <AdminWorkspace>
      <AdminEmptyState
        title="This admin route is not registered"
        description={
          <>
            The Admin OS will not silently replace an unknown workspace with Admin Home. Requested:{" "}
            <span className="font-mono text-white/70">{requestedPath}</span>
          </>
        }
        action={
          <Link href="/admin">
            <Button variant="outline" className="border-white/15 bg-transparent text-white">
              Return to Admin Home
            </Button>
          </Link>
        }
      />
    </AdminWorkspace>
  );
}
