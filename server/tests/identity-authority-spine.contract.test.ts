import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Release 2 identity authority spine", () => {
  it("binds protected middleware to one freshly resolved effective account", () => {
    const auth = read("server/auth.ts");

    expect(auth).toContain("async function bindRequestAuthority");
    expect(auth).toContain("export const bindAuthenticatedRequestAuthority");
    expect(auth).toContain("isAuthorityEscapeRequest(req)");
    expect(auth).toContain("blockImpersonatedPrivilege(req, res)");
    expect(auth).toContain('code: "IMPERSONATION_PRIVILEGE_BOUNDARY"');
    expect(auth).toContain("resolveRequestAuthorityContext(");
    expect(auth).toContain("authorityRequest.principalUser = context.principalUser");
    expect(auth).toContain("authorityRequest.user = context.effectiveUser");
    expect(auth).toContain('code: "AUTH_IDENTITY_CONTEXT_INVALID"');
    expect(auth).toContain('code: "AUTH_IDENTITY_CONTEXT_UNAVAILABLE"');
    for (const boundary of [
      "export const isAuthenticated",
      "export const requireOnboardingComplete",
      "export const requireRole",
      "export const requirePermission",
      "export const isBusinessProvider",
      "export const requireAuth",
      "export const requireAdmin",
    ]) {
      const start = auth.indexOf(boundary);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(auth.slice(start, start + 1400)).toContain("bindRequestAuthority(req, res)");
    }
  });

  it("keeps privileged routes and admin-only gates unavailable while impersonating", () => {
    const auth = read("server/auth.ts");

    expect(auth).toContain('"/api/admin"');
    expect(auth).toContain('"/api/admin-control"');
    expect(auth).toContain('"/api/prompt-admin"');
    expect(auth).toContain("allowedRoles.every((role) => ADMIN_AUTHORITY_ROLES.has(role))");
    expect(auth).toContain("ADMIN_ONLY_PERMISSIONS.has(permission)");
    expect(auth).toContain("blockImpersonatedPrivilege(req, res, true)");
  });

  it("mounts the identity spine before feature and standalone admin routers", () => {
    const routes = read("server/routes.ts");
    const setup = routes.indexOf("await setupAuth(app)");
    const binder = routes.indexOf("app.use(bindAuthenticatedRequestAuthority)");
    const admin = routes.indexOf("mountAdminRoutes(app)");

    expect(setup).toBeGreaterThanOrEqual(0);
    expect(binder).toBeGreaterThan(setup);
    expect(admin).toBeGreaterThan(binder);
  });

  it("returns the effective target workspace without merging principal admin authority", () => {
    const routes = read("server/routes.ts");
    const start = routes.indexOf('app.get("/api/auth/user"');
    const end = routes.indexOf("// Check if platform setup is needed", start);
    const authUserRoute = routes.slice(start, end);

    expect(authUserRoute).toContain("resolveRequestAuthorityContext(");
    expect(authUserRoute).toContain("const userId = identityContext.effectiveUserId");
    expect(authUserRoute).toContain("if (identityContext.isImpersonating) return baseUser");
    expect(authUserRoute).toContain("if (!identityContext.isImpersonating)");
    expect(authUserRoute).toContain("isImpersonating: true");
    expect(authUserRoute).toContain("impersonating: true");
    expect(authUserRoute).not.toContain("role: sessionAny.impersonatingRole");
  });

  it("blocks standalone privileged middleware during impersonation", () => {
    const sharedMiddleware = read("server/middleware/requireSuperAdmin.ts");
    const promptAdmin = read("server/routes/promptAdmin.ts");
    const adminControl = read("server/routes/admin-control.ts");

    for (const source of [sharedMiddleware, promptAdmin, adminControl]) {
      expect(source).toContain("resolveRequestEffectiveUser(req)");
      expect(source).toContain("identityContext.isImpersonating");
    }
    for (const source of [sharedMiddleware, promptAdmin]) {
      expect(source).toContain('code: "IMPERSONATION_PRIVILEGE_BOUNDARY"');
    }
  });
});
