import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("Direct Connect replies mobile control surface contracts", () => {
  it("renders compact quick-action/navigation controls", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain("rounded-lg border border-transparent bg-transparent p-0");
    expect(source).toContain("inline-flex h-11 min-w-0 items-center justify-center");
    expect(source).toContain("rounded-xl border px-2 text-[13px]");
  });

  it("renders compact status filters in replies", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('<div className="space-y-2.5">');
    expect(source).toContain('CardContent className="flex gap-2 overflow-x-auto p-1.5"');
    expect(source).toContain(
      'className="shrink-0 rounded-xl border px-3.5 text-[13px] font-medium transition-all h-10"'
    );
    expect(source).toContain('(["all", "suggested", "accepted", "declined"] as const)');
  });

  it("keeps reply cards as baseline content", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain("{visibleItems.map((item) => {");
    expect(source).toContain('request?.title || "New opportunity"');
    expect(source).toContain("inboxNextStepCopy.summary");
  });
});
