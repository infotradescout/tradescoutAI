// Backward-compat module: the Admin OS now uses a single registry.
// This file preserves the old exports to avoid churn across the codebase.

import type { AdminToolSection } from "./adminTools";
import {
  ADMIN_TOOL_SECTIONS,
  canSeeAdminTool,
  findActiveAdminTool,
  getAdminNavSectionsForRole,
  getAllAdminTools,
  type AdminRole,
  type AdminTool,
} from "./adminTools";

export type VisibilityRule = {
  roles?: AdminRole[];
};

export type SuperAdminNavItem = {
  id: string;
  label: string;
  path: string;
  icon: any;
  visibleIf?: VisibilityRule;
};

export type SuperAdminNavSection = {
  section: string;
  items: SuperAdminNavItem[];
};

export const SUPER_ADMIN_NAV: SuperAdminNavSection[] = ADMIN_TOOL_SECTIONS.map((section) => ({
  section: section.section,
  items: section.items.map((tool) => ({
    id: tool.id,
    label: tool.label,
    path: tool.path,
    icon: tool.icon,
    visibleIf: tool.visibleIf ? { roles: tool.visibleIf.roles } : undefined,
  })),
}));

export const canSee = (item: SuperAdminNavItem, role: AdminRole): boolean => {
  // Find the canonical tool by path; fall back to visibleIf.roles check.
  const tool: AdminTool | undefined = getAllAdminTools().find((t) => t.path === item.path);
  if (tool) return canSeeAdminTool(tool, role);
  if (!item.visibleIf || !item.visibleIf.roles || item.visibleIf.roles.length === 0) return true;
  return item.visibleIf.roles.includes(role);
};

export const getSuperAdminNavForRole = (role: AdminRole): SuperAdminNavSection[] => {
  const sections: AdminToolSection[] = getAdminNavSectionsForRole(role);
  return sections.map((section) => ({
    section: section.section,
    items: section.items.map((tool) => ({
      id: tool.id,
      label: tool.label,
      path: tool.path,
      icon: tool.icon,
      visibleIf: tool.visibleIf ? { roles: tool.visibleIf.roles } : undefined,
    })),
  }));
};

export function findActiveItem(pathname: string | null): SuperAdminNavItem | null {
  const tool = findActiveAdminTool(pathname);
  if (!tool) return null;
  return {
    id: tool.id,
    label: tool.label,
    path: tool.path,
    icon: tool.icon,
    visibleIf: tool.visibleIf ? { roles: tool.visibleIf.roles } : undefined,
  };
}

export type { AdminRole };
