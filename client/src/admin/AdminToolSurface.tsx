import type { ReactNode } from "react";
import type { AdminTool } from "./adminTools";
import "./admin-os-v2.css";

const NATIVE_ADMIN_V2_TOOLS = new Set([
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
]);

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
