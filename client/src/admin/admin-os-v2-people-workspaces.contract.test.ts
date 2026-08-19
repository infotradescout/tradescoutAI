import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Admin OS v2 people workspaces", () => {
  it("marks Users and Moderation as native v2 surfaces", () => {
    const surface = read("client/src/admin/AdminToolSurface.tsx");

    expect(surface).toContain('"users"');
    expect(surface).toContain('"moderation"');
  });

  it("rebuilds Users as an expandable operating queue without weakening account safety", () => {
    const page = read("client/src/pages/admin-users.tsx");

    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminToolbar");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-users-v2"');
    expect(page).toContain("User accounts");
    expect(page).toContain("Archived import placeholders remain separate");
    expect(page).toContain("<details key={target.id}");
    expect(page).not.toContain("<Table");
    expect(page).not.toContain("<Card");

    expect(page).toContain('queryKey: ["/api/admin/users"]');
    expect(page).toContain('apiRequest("PUT", `/api/admin/users/${userId}/role`');
    expect(page).toContain('apiRequest("DELETE", `/api/admin/users/${userId}`');
    expect(page).toContain('apiRequest("POST", "/api/admin/users/info"');
    expect(page).toContain('apiRequest("PUT", `/api/admin/users/${profileUser.id}/profile`');
    expect(page).toContain('/api/admin/user-controls/suspend/${userId}');
    expect(page).toContain('/api/admin/user-controls/unsuspend/${userId}');
    expect(page).toContain('/api/admin/user-controls/verify/${userId}');
    expect(page).toContain('/api/admin/user-controls/revoke-verify/${userId}');
    expect(page).toContain('/api/admin/user-controls/role/${userId}');
    expect(page).toContain('"/api/auth/request-email-verification"');
    expect(page).toContain('/api/admin/impersonate/start/${target.id}');

    expect(page).toContain("ADMIN_SAFETY_CONFIRM_PHRASE");
    expect(page).toContain('"I UNDERSTAND THIS EDIT IS AUDITED"');
    expect(page).toContain("Audit reason required");
    expect(page).toContain("minimum 12 characters");
    expect(page).toContain("Impersonation reason required");
    expect(page).toContain("You cannot delete your own account");
    expect(page).toContain("Only a Super Admin can delete a Super Admin account");
    expect(page).toContain("Delete user ${displayEmail(target)}? This cannot be undone.");
  });

  it("preserves user support, filters, saved views, archive separation, and profile editing", () => {
    const page = read("client/src/pages/admin-users.tsx");

    expect(page).toContain('data-testid="admin-user-support-tools"');
    expect(page).toContain("Verification email");
    expect(page).toContain("Admin write safety key");
    expect(page).toContain("Saved views");
    expect(page).toContain("adminUsersSavedViews:");
    expect(page).toContain('"ts:admin:safety-key"');
    expect(page).toContain("Export");
    expect(page).toContain("Search name, email, or archived original email");
    expect(page).toContain("active_only");
    expect(page).toContain("archived_only");
    expect(page).toContain("admin_import_cleanup");
    expect(page).toContain("Edit public profile and account state");
    expect(page).toContain("Public profile sections");
    expect(page).toContain("Profile colors");
    expect(page).toContain("Profile visibility");
  });

  it("rebuilds Moderation around explicit queues and visible unavailable states", () => {
    const page = read("client/src/pages/content-moderation.tsx");

    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminWorkspaceSubnav");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-moderation-v2"');
    expect(page).toContain("Flagged content");
    expect(page).toContain("Recent actions");
    expect(page).toContain("Kick escalations");
    expect(page).toContain("QueueUnavailable");
    expect(page).not.toContain("<Card");
    expect(page).not.toContain("Moderation Tools");

    expect(page).toContain('apiRequest("GET", "/api/admin/moderation/flagged")');
    expect(page).toContain('apiRequest("GET", "/api/admin/moderation/reports")');
    expect(page).toContain('apiRequest("GET", "/api/admin/moderation/recent-actions")');
    expect(page).toContain('apiRequest("GET", "/api/admin/moderation/kick-queue")');
    expect(page).toContain('/api/admin/moderation/approve/${contentId}');
    expect(page).toContain('/api/admin/moderation/remove/${contentId}');
    expect(page).toContain('/api/admin/moderation/kick-queue/${reportId}/decision');
    expect(page).toContain('/api/admin/moderation/kick-queue/${reportId}/ops-ban');
  });

  it("keeps destructive moderation actions reasoned, confirmed, and role separated", () => {
    const page = read("client/src/pages/content-moderation.tsx");

    expect(page).toContain("Removal reason required");
    expect(page).toContain("at least five characters");
    expect(page).toContain("This action is destructive and logged");
    expect(page).toContain("isOpsOrAbove");
    expect(page).toContain("Apply a durable ban and hard suspension");
    expect(page).toContain('decision: "dismiss"');
    expect(page).toContain('decision: "warning"');
    expect(page).toContain('decision: "suspend"');
    expect(page).toContain('decision: "recommend_ban"');
  });

  it("records the Selective Intelligence preservation boundary", () => {
    const evidence = read(
      ".selective-intelligence/builds/admin-os-v2-people-workspaces/evidence.md"
    );

    expect(evidence).toContain("People operations cannot remain a giant legacy table");
    expect(evidence).toContain("Archived import placeholders remain visibly separate");
    expect(evidence).toContain("failed reads into empty arrays");
    expect(evidence).toContain("Staff kick-vote decisions kept separate");
    expect(evidence).toContain("does not");
    expect(evidence).toContain("Authenticated desktop and mobile screenshots");
  });
});
