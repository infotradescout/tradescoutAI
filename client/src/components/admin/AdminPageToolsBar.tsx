import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { MessageCircle, Shield, Users, LayoutDashboard, Settings, FileText, ListChecks } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AdminToolLink {
  id: string;
  label: string;
  href: string;
  description?: string;
}

export const SUPER_ADMIN_ROLES = ["head_admin", "ops_admin", "super_admin", "admin"] as const;

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
        href: "/admin/pricing-analytics",
        description: "Review Exchange fee performance & experiments",
      }
    );
  }

  if (path.startsWith("/dashboard")) {
    tools.push({
      id: "admin-workspace",
      label: "Ops Workspace",
      href: "/admin/workspace",
      description: "System stats, flags, and verification queues",
    });
  }

  return tools;
}

export function buildAdminTools(path: string): AdminToolLink[] {
  if (!path) return [] as AdminToolLink[];

  const pageTools = buildPageTools(path);

  const baseTools: AdminToolLink[] = [
    {
      id: "admin-dashboard",
      label: "Admin Dashboard",
      href: "/admin",
      description: "Admin OS overview: coverage, ops, and queues",
    },
    {
      id: "admin-users",
      label: "User Management",
      href: "/admin/users",
      description: "Search, edit roles, and impersonate users",
    },
    {
      id: "messages",
      label: "Message Users",
      href: "/messages",
      description: "Jump into conversations & outreach",
    },
  ];

  const byId = new Map<string, AdminToolLink>();
  [...pageTools, ...baseTools].forEach((tool) => {
    if (!byId.has(tool.id)) {
      byId.set(tool.id, tool);
    }
  });

  return Array.from(byId.values());
}

export function AdminPageToolsBar() {
  const { user, isAuthenticated } = useAuth();
  const [path, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  // Use the computed isSuperAdmin flag from the auth payload, with fallback to role check
  const isSuperAdmin = !!(
    isAuthenticated &&
    ((user as any)?.isSuperAdmin === true ||
     (user?.role && SUPER_ADMIN_ROLES.includes(user.role as (typeof SUPER_ADMIN_ROLES)[number])))
  );

  const tools = useMemo(() => {
    return buildAdminTools(path || "");
  }, [path]);

  if (!isSuperAdmin || tools.length === 0) {
    return null;
  }

  const handleNavigate = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <Card className="mb-2 w-72 bg-slate-950/95 border-slate-800 shadow-xl shadow-orange-500/20">
          <div className="px-4 pt-3 pb-2 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-400" />
              <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
                Super Admin Tools
              </span>
            </div>
            <span className="text-[0.7rem] text-slate-500">{path}</span>
          </div>
          <div className="max-h-80 overflow-y-auto px-2 py-2 space-y-1">
            {tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleNavigate(tool.href)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs",
                  "bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80",
                  "flex flex-col gap-0.5"
                )}
              >
                <span className="font-medium text-slate-50 flex items-center gap-1.5">
                  {tool.id === "messages" && <MessageCircle className="h-3 w-3 text-orange-400" />}
                  {tool.id === "admin-dashboard" && <LayoutDashboard className="h-3 w-3 text-orange-400" />}
                  {tool.id === "admin-panel" && <Settings className="h-3 w-3 text-orange-400" />}
                  {tool.id === "admin-users" && <Users className="h-3 w-3 text-orange-400" />}
                  {tool.id === "listings-admin" && <ListChecks className="h-3 w-3 text-orange-400" />}
                  {!["messages","admin-dashboard","admin-panel","admin-users","listings-admin"].includes(tool.id) && (
                    <FileText className="h-3 w-3 text-orange-400" />
                  )}
                  <span>{tool.label}</span>
                </span>
                {tool.description && (
                  <span className="text-[0.7rem] text-slate-400 line-clamp-2">
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
        className="border-orange-500/70 bg-slate-950/90 text-xs text-orange-100 hover:bg-slate-900 flex items-center gap-2 shadow-lg shadow-orange-500/30"
      >
        <Shield className="h-3 w-3 text-orange-400" />
        <span>Admin Tools</span>
        <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[0.65rem] font-semibold text-slate-950">
          {tools.length}
        </span>
      </Button>
    </div>
  );
}
