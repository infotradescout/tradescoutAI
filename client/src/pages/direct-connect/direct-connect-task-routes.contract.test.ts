import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shellSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/direct-connect/DirectConnectShell.tsx"),
  "utf8"
);
const routeSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/direct-connect/directConnectRoutes.ts"),
  "utf8"
);

describe("Direct Connect task-route contract", () => {
  it("uses task language for the canonical app screens", () => {
    expect(shellSource).toContain('post: "Post"');
    expect(shellSource).toContain('board: "Board"');
    expect(shellSource).toContain('employment: "Jobs"');
    expect(shellSource).toContain('inbox: "Inbox"');
    expect(shellSource).toContain('pros: "Businesses"');
    expect(shellSource).toContain('engagements: "My Requests"');
  });

  it("preserves old section names while emitting canonical task paths", () => {
    expect(routeSource).toContain('active: "engagements"');
    expect(routeSource).toContain('opportunities: "employment"');
    expect(routeSource).toContain('businesses: "pros"');
    expect(routeSource).toContain('engagements: "active"');
    expect(routeSource).toContain('employment: "opportunities"');
    expect(routeSource).toContain('pros: "businesses"');
  });
});
