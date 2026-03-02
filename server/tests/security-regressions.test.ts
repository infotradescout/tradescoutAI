import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..");

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("security regressions", () => {
  it("disables legacy emergency admin access backdoor", () => {
    const routes = readRepoFile("server/routes.ts");
    expect(routes).toContain('"/api/auth/emergency-admin-access"');
    expect(routes).toContain("status(410)");
    expect(routes).not.toContain("927070657");
  });

  it("does not allow unauth master-admin binding via connect-master-admin", () => {
    const routes = readRepoFile("server/routes.ts");
    expect(routes).toContain('"/api/auth/connect-master-admin"');
    expect(routes).toContain('requireRole(["head_admin"])');
    expect(routes).not.toContain("mrplatypus4777@gmail.com");
  });

  it("Socket.IO auth is session-derived (not client-declared userId)", () => {
    const messagingService = readRepoFile("server/messaging-service.ts");
    expect(messagingService).toContain("loadSocketSession(socket)");
    expect(messagingService).toContain("extractSessionUserId");
    expect(messagingService).not.toContain("missing userId");
    expect(messagingService).not.toContain("(socket.handshake.auth as any)?.userId;");
  });

  it("admin impersonation secret has no hardcoded fallback", () => {
    const service = readRepoFile("server/services/adminImpersonationService.ts");
    expect(service).toContain("IMPERSONATION_SECRET");
    expect(service).not.toContain("impersonation_secret");
    expect(service).not.toContain("|| '");
  });
});
