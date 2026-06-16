import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("direct connect notification center ui contract", () => {
  it("uses direct connect notification endpoints", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("/api/direct-connect/notifications");
    expect(source).toContain("/api/direct-connect/notifications/read-all");
    expect(source).toContain("/notifications/${encodeURIComponent(notificationId)}/read");
    expect(source).toContain("/notifications/${encodeURIComponent(notificationId)}/archive");
  });

  it("keeps unread badge and archive behavior in shell", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("unreadDirectConnectNotificationCount");
    expect(source).toContain('status !== "archived"');
    expect(source).toContain("Mark reviewed");
    expect(source).toContain("Hide update");
  });

  it("contains optimistic update rollback paths", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    expect(source).toContain("onMutate");
    expect(source).toContain("onError");
    expect(source).toContain("onSettled");
    expect(source).toContain("context?.previous");
  });
});
