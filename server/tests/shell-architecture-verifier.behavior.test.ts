import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const verifier = path.resolve("scripts/verify-shell-architecture.js");

function verify(files: Record<string, string>) {
  const fixture = fs.mkdtempSync(path.resolve(".shell-verifier-test-"));
  try {
    for (const [relativePath, source] of Object.entries(files)) {
      const file = path.join(fixture, "client/src", relativePath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, source);
    }
    const result = spawnSync(process.execPath, [verifier], { cwd: fixture, encoding: "utf8" });
    if (result.error) throw result.error;
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

describe("page-shell architecture verifier", () => {
  it("accepts physical-room data types and predicates outside page shells", () => {
    expect(
      verify({
        "models/room.ts": `export type CabinetRoomShell = { width: number };
        export interface RoomShell { width: number }
        export function hasResolvedCountertopRoomShell() { return true; }`,
      }).status
    ).toBe(0);
  });

  it.each([
    "export function DashboardShell() { return null; }",
    "export const DashboardShell = () => null;",
    "export default function DashboardShell() { return null; }",
    "export async function DashboardShell() { return null; }",
  ])("rejects misplaced component exports: %s", (source) => {
    const result = verify({ "pages/dashboard.tsx": source });
    expect(result.status).toBe(1);
    expect(result.output).toContain("DashboardShell");
  });

  it("accepts a component under the canonical page-shell owner", () => {
    expect(
      verify({ "shells/DashboardShell.tsx": "export function DashboardShell() { return null; }" })
        .status
    ).toBe(0);
  });

  it("continues rejecting dependencies between page shells", () => {
    const result = verify({
      "shells/DashboardShell.tsx": 'import { OtherShell } from "./OtherShell";',
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("Shell file imports another shell file");
  });

  it("continues rejecting the retired Community shell in a page", () => {
    const result = verify({
      "pages/community.tsx":
        'import { CommunityShell } from "../components/layout/CommunityShell";',
    });
    expect(result.status).toBe(1);
    expect(result.output).toContain("Imports CommunityShell");
  });
});
