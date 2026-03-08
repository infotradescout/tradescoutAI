import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Shield, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAdminNavSectionsForRole, type AdminRole } from "@/admin/adminTools";
import { hasAdminUiAccess, isSuperAdminLike } from "@/lib/roleChecks";

export interface AdminToolLink {
  id: string;
  label: string;
  href: string;
  description?: string;
}

export function buildPageTools(path: string): AdminToolLink[] {
  const tools: AdminToolLink[] = [];

  if (path.startsWith("/community")) {
    tools.push({
      id: "content-moderation",
      label: "Moderate Community",
      href: "/content-moderation",
      description: "Review posts, reports, and flags for this area",
    });
  }

  if (path.startsWith("/contractors")) {
    tools.push(
      {
        id: "contractor-verification",
        label: "Verify Contractors",
        href: "/contractor-verification",
        description: "Review license & insurance for active pros",
      },
      {
        id: "listings-admin",
        label: "Listings Admin",
        href: "/admin/listings",
        description: "Manage Exchange/board listings tied to this view",
      }
    );
  }

  if (path.startsWith("/exchange") || path.startsWith("/marketplace")) {
    tools.push(
      {
        id: "exchange-listings",
        label: "Listings Management",
        href: "/admin/listings",
        description: "Approve and manage Exchange listings",
      },
      {
        id: "pricing-analytics",
        label: "Pricing Analytics",
        href: "/admin/pricing",
        description: "Review Exchange fee performance & experiments",
      }
    );
  }

  if (path.startsWith("/dashboard")) {
    tools.push({
      id: "admin-workspace",
      label: "Ops Workspace",
      href: "/admin/control",
      description: "System stats, flags, and verification queues",
    });
  }

  return tools;
}

export function buildAdminTools(
  path: string,
  opts: { role: AdminRole; isSuperAdmin: boolean }
): AdminToolLink[] {
  // Backward compat: keep callsites, but source from the Admin OS registry.
  // This ensures the floating launcher never drifts from the left nav/router.
  const sections = getAdminNavSectionsForRole(opts.role, opts.isSuperAdmin);
  const flattened = sections.flatMap((s) => s.items);

  const registryTools: AdminToolLink[] = flattened.map((t) => ({
    id: t.id,
    label: t.label,
    href: t.path,
  }));

  const pageTools = buildPageTools(path);
  const byId = new Map<string, AdminToolLink>();
  [...pageTools, ...registryTools].forEach((tool) => {
    if (!byId.has(tool.id)) byId.set(tool.id, tool);
  });
  return Array.from(byId.values()).slice(0, 12);
}

export function AdminPageToolsBar() {
  const { user, isAuthenticated } = useAuth();
  const [path, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  const role = ((user?.role as AdminRole) || "ops_admin") as AdminRole;
  const rawRole = typeof (user as any)?.role === "string" ? String((user as any).role) : "";
  const isAdmin = Boolean(
    isAuthenticated && (hasAdminUiAccess(user) || rawRole.trim().toLowerCase() === "moderator")
  );
  const isSuperAdmin = Boolean((user as any)?.isSuperAdmin === true || isSuperAdminLike(rawRole));

  const tools = useMemo(() => {
    return buildAdminTools(path || "", { role, isSuperAdmin });
  }, [path, role, isSuperAdmin]);

  if (!isAdmin || tools.length === 0) {
    return null;
  }

  const handleNavigate = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <Card className="mb-2 w-72 bg-black/30 border-white/10 shadow-xl shadow-orange-500/20">
          <div className="px-4 pt-3 pb-2 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-ts-orange" />
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-white/60">
                Admin Tools
              </span>
            </div>
            <span className="text-[0.7rem] text-white/60">{path}</span>
          </div>
          <div className="max-h-80 overflow-y-auto px-2 py-2 space-y-1">
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleNavigate(tool.href)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs",
                  "bg-tsCard/95 hover:bg-white/5 border border-white/10",
                  "flex flex-col gap-0.5"
                )}
              >
                <span className="font-medium text-white flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-ts-orange" />
                  <span>{tool.label}</span>
                </span>
                {tool.description && (
                  <span className="text-[0.7rem] text-white/60 line-clamp-2">
                    {tool.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((prev) => !prev)}
        className="border-ts-orange/30 bg-black/30 text-xs text-ts-orange hover:bg-tsCard flex items-center gap-2 shadow-lg shadow-orange-500/30"
      >
        <Shield className="h-3 w-3 text-ts-orange" />
        <span>Admin Tools</span>
        <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-ts-orange text-[0.65rem] font-semibold text-black">
          {tools.length}
        </span>
      </Button>
    </div>
  );
}
