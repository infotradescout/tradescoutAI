import type { ReactNode } from "react";
import type { AdminTool } from "./adminTools";
import "./admin-os-v2.css";

export const NATIVE_ADMIN_V2_TOOL_IDS = [
  "overview",
  "users",
  "tradepartner-ops",
  "direct-connect-requests",
  "verification",
  "business-verifications",
  "business-directory-ops",
  "listings",
  "moderation",
  "errors",
  "panel",
  "controls",
  "production-acceptance",
  "live-stream",
  "business-onboarding-telemetry",
  "discovery-observatory",
  "ecosystem-truth",
  "scout-resilience",
  "geo-map",
  "commercial-directory",
  "procurement",
  "crm",
  "finance",
] as const;

const NATIVE_ADMIN_V2_TOOLS = new Set<string>(NATIVE_ADMIN_V2_TOOL_IDS);

export function isNativeAdminV2Tool(toolId: string): boolean {
  return NATIVE_ADMIN_V2_TOOLS.has(toolId);
}

export function AdminToolSurface({
  tool,
  children,
}: {
  tool: AdminTool;
  children: ReactNode;
}) {
  const native = isNativeAdminV2Tool(tool.id);

  return (
    <div
      className={
        native
          ? "ts-admin-tool-surface ts-admin-tool-surface--native"
          : "ts-admin-tool-surface ts-admin-tool-surface--adapted"
      }
      data-admin-tool={tool.id}
      data-admin-surface={native ? "native-v2" : "adapted-v1"}
    >
      {children}
    </div>
  );
}
