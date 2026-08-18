import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect notification center ui contract", () => {
  it("keeps Direct Connect shell free of duplicate notification-center ownership", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const appShell = read("client/src/components/layout/AppShellCore.tsx");

    expect(source).not.toContain("/api/direct-connect/notifications");
    expect(source).not.toContain("unreadDirectConnectNotificationCount");
    expect(source).not.toContain("showNotificationCenter");
    expect(appShell).toContain("<NotificationCenter />");
    expect(appShell).toContain('aria-label="Notifications"');
  });
});
