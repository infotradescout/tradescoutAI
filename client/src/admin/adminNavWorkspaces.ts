import {
  canSeeAdminTool,
  getAllAdminTools,
  type AdminRole,
  type AdminTool,
  type AdminToolSection,
} from "./adminTools";

type AdminNavToolDefinition = {
  id: string;
  label?: string;
  description?: string;
};

type AdminNavWorkspaceDefinition = {
  section: string;
  tools: AdminNavToolDefinition[];
};

const ADMIN_NAV_WORKSPACES: AdminNavWorkspaceDefinition[] = [
  {
    section: "Inbox & Requests",
    tools: [
      {
        id: "overview",
        label: "Admin Home",
        description: "Prioritized work, operating signals, and common workspaces.",
      },
      {
        id: "direct-connect-requests",
        label: "Requests",
        description: "Review routed customer requests and their response state.",
      },
      {
        id: "commercial-directory",
        label: "Commercial Work",
        description: "Manage commercial jobs, bids, and project documents.",
      },
      {
        id: "procurement",
        description: "Operate supply runs, orders, quote review, and workspaces.",
      },
    ],
  },
  {
    section: "People & Trust",
    tools: [
      { id: "users" },
      {
        id: "verification",
        label: "Address & Identity",
        description: "Review identity, address, and claim verification queues.",
      },
      {
        id: "business-verifications",
        label: "Business Verification",
      },
      { id: "moderation" },
      {
        id: "business-directory-ops",
        label: "Business Directory",
      },
    ],
  },
  {
    section: "Partners & Market",
    tools: [
      {
        id: "tradepartner-ops",
        label: "Partner Operations",
        description: "Onboard partners, audit live profiles, and run partner programs.",
      },
      {
        id: "listings",
        label: "Marketplace Listings",
      },
      {
        id: "crm",
        label: "Sales Pipeline",
      },
    ],
  },
  {
    section: "Coverage & Intelligence",
    tools: [
      {
        id: "geo-map",
        label: "County Coverage",
      },
      {
        id: "business-onboarding-telemetry",
        label: "Onboarding Health",
      },
      {
        id: "discovery-observatory",
        label: "Discovery",
      },
    ],
  },
  {
    section: "Platform",
    tools: [
      {
        id: "live-stream",
        label: "System Status",
      },
      { id: "scout-resilience" },
      { id: "errors" },
      {
        id: "panel",
        label: "Platform Settings",
      },
      {
        id: "controls",
        label: "Platform Controls",
      },
    ],
  },
  {
    section: "Finance",
    tools: [
      {
        id: "finance",
        label: "Finance",
      },
    ],
  },
];

const overrideById = new Map(
  ADMIN_NAV_WORKSPACES.flatMap((workspace) => workspace.tools).map((tool) => [tool.id, tool])
);

export function getAdminToolPresentation(tool: AdminTool): AdminTool {
  const override = overrideById.get(tool.id);
  if (!override) return tool;
  return {
    ...tool,
    label: override.label || tool.label,
    description: override.description || tool.description,
  };
}

export function getAdminNavWorkspacesForRole(
  role: AdminRole,
  isSuperAdminFlag?: boolean
): AdminToolSection[] {
  const allTools = getAllAdminTools();
  const toolById = new Map(allTools.map((tool) => [tool.id, tool]));
  const includedIds = new Set<string>();

  const workspaces = ADMIN_NAV_WORKSPACES.map((workspace) => {
    const items = workspace.tools.flatMap((definition) => {
      const tool = toolById.get(definition.id);
      if (!tool || tool.navHidden === true || !canSeeAdminTool(tool, role, isSuperAdminFlag)) {
        return [];
      }
      includedIds.add(tool.id);
      return [getAdminToolPresentation(tool)];
    });
    return { section: workspace.section, items };
  }).filter((workspace) => workspace.items.length > 0);

  const remaining = allTools
    .filter(
      (tool) =>
        tool.navHidden !== true &&
        !includedIds.has(tool.id) &&
        canSeeAdminTool(tool, role, isSuperAdminFlag)
    )
    .map(getAdminToolPresentation);

  if (remaining.length > 0) {
    workspaces.push({ section: "More", items: remaining });
  }

  return workspaces;
}
