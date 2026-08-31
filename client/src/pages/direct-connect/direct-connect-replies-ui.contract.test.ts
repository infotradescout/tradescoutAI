import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Direct Connect replies mobile control surface contracts", () => {
  it("renders the compact role-labeled task switcher", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('data-testid="direct-connect-task-switcher"');
    expect(source).toContain('aria-label="Direct Connect tasks"');
    expect(source).toContain("DIRECT_CONNECT_WORKDESK_TASKS.map");
    expect(source).toContain('role: "Provider"');
    expect(source).toContain('role: "Requester"');
  });

  it("renders compact status filters in replies", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('<div className="space-y-3">');
    expect(source).toContain('<div className="flex gap-2 overflow-x-auto pb-0.5">');
    expect(source).toContain(
      'className="h-10 min-h-[44px] shrink-0 rounded-xl border px-3.5 text-[13px] font-medium transition-all sm:min-h-10"'
    );
    expect(source).toContain("max-md:[&_button]:!min-h-[44px]");
    expect(source).toContain('(["all", "suggested", "accepted", "declined"] as const)');
  });

  it("keeps a selectable provider queue and one action-aware inspector", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('data-testid="direct-connect-incoming-workspace"');
    expect(source).toContain('data-testid="incoming-list"');
    expect(source).toContain('data-testid="incoming-inspector"');
    expect(source).toContain("[selectedItem].map");
    expect(source).toContain("isRealDirectConnectAssignmentId(item.assignment.id)");
    expect(source).toContain("inboxNextStepCopy.summary");
  });

  it("keeps mobile progression, truthful retry, and Messages ownership explicit", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('id="direct-connect-incoming-back"');
    expect(source).toContain("ref={selected ? selectedRowRef : undefined}");
    expect(source).toContain("const selectedRow = selectedRowRef.current;");
    expect(source).toContain("window.requestAnimationFrame(() => selectedRow?.focus());");
    expect(source).toContain("Back to Incoming");
    expect(source).toContain("Incoming assignments couldn’t load");
    expect(source).toContain("Retry Incoming");
    expect(source).toContain("`/messages?thread=${encodeURIComponent(String(threadId))}`");
  });
});
