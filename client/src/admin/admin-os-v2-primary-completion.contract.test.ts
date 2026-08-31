import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

const PRIMARY_TOOL_IDS = [
  "overview",
  "direct-connect-requests",
  "commercial-directory",
  "procurement",
  "users",
  "verification",
  "business-verifications",
  "moderation",
  "business-directory-ops",
  "tradepartner-ops",
  "listings",
  "crm",
  "geo-map",
  "business-onboarding-telemetry",
  "discovery-observatory",
  "live-stream",
  "scout-resilience",
  "errors",
  "panel",
  "controls",
  "production-acceptance",
  "finance",
] as const;

describe("Admin OS v2 primary workspace completion", () => {
  it("declares exactly twenty-two primary outcome-based navigation tools", () => {
    const source = read("client/src/admin/adminNavWorkspaces.ts");
    const start = source.indexOf("const ADMIN_NAV_WORKSPACES");
    const end = source.indexOf("const overrideById", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const block = source.slice(start, end);
    const ids = Array.from(block.matchAll(/id:\s*"([^"]+)"/g), (match) => match[1]);

    expect(ids).toHaveLength(22);
    expect(unique(ids)).toHaveLength(22);
    expect(sorted(ids)).toEqual(sorted([...PRIMARY_TOOL_IDS]));
  });

  it("registers exactly the same twenty-two tools as native Admin OS v2 surfaces", () => {
    const source = read("client/src/admin/AdminToolSurface.tsx");
    const start = source.indexOf("export const NATIVE_ADMIN_V2_TOOL_IDS");
    const end = source.indexOf("] as const;", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const block = source.slice(start, end);
    const ids = Array.from(block.matchAll(/"([^"]+)"/g), (match) => match[1]);

    expect(ids).toHaveLength(22);
    expect(unique(ids)).toHaveLength(22);
    expect(sorted(ids)).toEqual(sorted([...PRIMARY_TOOL_IDS]));
    expect(source).toContain("new Set<string>(NATIVE_ADMIN_V2_TOOL_IDS)");
  });

  it("keeps every primary tool visible in the registered admin tool authority", () => {
    const source = read("client/src/admin/adminTools.tsx");
    const matches = Array.from(source.matchAll(/id:\s*"([^"]+)"/g));

    for (const id of PRIMARY_TOOL_IDS) {
      const matchIndex = matches.findIndex((match) => match[1] === id);
      expect(matchIndex, `missing primary admin tool ${id}`).toBeGreaterThanOrEqual(0);

      const match = matches[matchIndex];
      const next = matches[matchIndex + 1];
      const start = match.index || 0;
      const end = next?.index || source.length;
      const toolBlock = source.slice(start, end);
      expect(toolBlock, `${id} must remain role-visible`).not.toContain("navHidden: true");
    }
  });

  it("reserves adapted-v1 for hidden detail and compatibility routes", () => {
    const source = read("client/src/admin/AdminToolSurface.tsx");
    const hiddenOrDetailIds = [
      "procurement-order",
      "procurement-workspaces",
      "commercial-contractors",
      "vault-contributions",
      "observability",
      "ai-monitoring",
      "tool-discovery",
    ];

    for (const id of hiddenOrDetailIds) {
      expect(source).not.toContain(`"${id}",`);
    }
    expect(source).toContain('data-admin-surface={native ? "native-v2" : "adapted-v1"}');
  });

  it("records structural completion without claiming unauthenticated visual approval", () => {
    const source = read("docs/architecture/ADMIN_OS_V2.md");

    expect(source).toContain("The primary Admin OS migration is structurally complete");
    expect(source).toContain(
      "Every primary role-visible navigation tool is registered as a native v2 surface"
    );
    expect(source).toContain("The 22 outcome-based navigation tools are native v2 surfaces");
    expect(source).toContain("Authenticated browser evidence remains the authority");
  });
});
