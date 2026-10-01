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
      { id: "professional-verification", label: "Professional Credentials" },
      { id: "contractor-settings", label: "Business Provider Settings" },
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
      { id: "tradepartner-interest", label: "Partner Interest" },
      { id: "tradepartner-rsvps", label: "Event Attendance" },
      { id: "homescout-listings", label: "HomeScout Listings" },
      { id: "homescout-sources", label: "HomeScout Sources" },
      { id: "commercial-contractors", label: "Commercial Providers" },
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
      { id: "cumulus-intelligence", label: "County Commercial Signals" },
      { id: "platform-analytics" },
      { id: "business-import" },
    ],
  },
  {
    section: "Platform",
    tools: [
      {
        id: "ecosystem-truth",
        label: "Ecosystem Truth",
        description:
          "See current owners, decision evidence, commercial conflicts, and outcome links.",
      },
      {
        id: "production-acceptance",
        label: "Production Acceptance",
        description: "Review current production truth across every operating lane.",
      },
      {
        id: "live-stream",
        label: "System Status",
      },
      { id: "scout-resilience" },
      { id: "errors" },
      { id: "attachments" },
      { id: "notifications", label: "Notifications" },
      { id: "ads", label: "Advertisements" },
      { id: "prizes" },
      { id: "share-links" },
      { id: "audit-log" },
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
      { id: "vault-contributions" },
      { id: "affiliates" },
      { id: "pricing" },
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
      if (!tool || !canSeeAdminTool(tool, role, isSuperAdminFlag)) {
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

/** Every permitted registered route remains discoverable, including compatibility tools. */
export function getAdminSearchWorkspacesForRole(
  role: AdminRole,
  isSuperAdminFlag?: boolean
): AdminToolSection[] {
  const workspaces = getAdminNavWorkspacesForRole(role, isSuperAdminFlag);
  const included = new Set(
    workspaces.flatMap((workspace) => workspace.items.map((tool) => tool.id))
  );
  const additional = getAllAdminTools()
    .filter((tool) => !included.has(tool.id) && canSeeAdminTool(tool, role, isSuperAdminFlag))
    .map(getAdminToolPresentation);
  return additional.length
    ? [...workspaces, { section: "Additional tools & older routes", items: additional }]
    : workspaces;
}
