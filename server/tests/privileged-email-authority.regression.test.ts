import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isBusinessProvider, requireAdmin, requireOnboardingComplete, requireRole } from "../auth";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const withReservedEmail = async (email: string, run: () => Promise<void>) => {
  const previous = process.env.PRIVILEGED_ALIAS_EMAILS;
  process.env.PRIVILEGED_ALIAS_EMAILS = email;
  try {
    await run();
  } finally {
    if (typeof previous === "undefined") {
      delete process.env.PRIVILEGED_ALIAS_EMAILS;
    } else {
      process.env.PRIVILEGED_ALIAS_EMAILS = previous;
    }
  }
};

const invoke = async (middleware: any, user: Record<string, unknown>) => {
  const next = vi.fn();
  const res: any = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  await middleware(
    {
      user,
      isAuthenticated: () => true,
    } as any,
    res,
    next
  );

  return { next, res };
};

describe("reserved authority email regression", () => {
  it.each([
    {
      label: "persisted email",
      user: { email: "candidate@example.com", claims: { email: "ordinary@example.com" } },
    },
    {
      label: "claims email",
      user: { email: "ordinary@example.com", claims: { email: "candidate@example.com" } },
    },
  ])("does not grant middleware authority from a $label alias", async ({ user }) => {
    await withReservedEmail("candidate@example.com", async () => {
      const ordinaryUser = {
        ...user,
        id: "ordinary-user",
        role: "homeowner",
        activeRole: "homeowner",
        roles: ["homeowner"],
        isAdmin: false,
        isSuperAdmin: false,
        onboardingCompleted: false,
      };

      for (const middleware of [
        requireOnboardingComplete,
        requireRole(["super_admin"]),
        isBusinessProvider,
        requireAdmin,
      ]) {
        const { next, res } = await invoke(middleware, ordinaryUser);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
      }
    });
  });

  it("continues to honor persisted admin flags", async () => {
    const persistedAdmin = {
      id: "persisted-admin",
      email: "ordinary@example.com",
      role: "homeowner",
      roles: ["homeowner"],
      isSuperAdmin: true,
      onboardingCompleted: false,
    };

    for (const middleware of [
      requireOnboardingComplete,
      requireRole(["super_admin"]),
      isBusinessProvider,
      requireAdmin,
    ]) {
      const { next } = await invoke(middleware, persistedAdmin);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it("rejects reserved emails in both public registration handlers before writes or login", () => {
    const routes = read("server/routes.ts");
    const multi = routes.slice(
      routes.indexOf("const handleRegisterMultiProfile"),
      routes.indexOf("const handleRegister =")
    );
    const standard = routes.slice(
      routes.indexOf("const handleRegister ="),
      routes.indexOf('app.post("/auth/register"')
    );

    for (const [handler, firstWrite] of [
      [multi, "const created = await db.transaction"],
      [standard, "const user = await storage.createUser"],
    ] as const) {
      const rejection = handler.indexOf("if (isReservedSignupIdentityEmail(email))");
      expect(rejection).toBeGreaterThan(-1);
      expect(rejection).toBeLessThan(handler.indexOf(firstWrite));
      expect(rejection).toBeLessThan(handler.indexOf("req.login("));
    }
  });

  it("prevents social signup from creating a new reserved authority identifier", () => {
    const auth = read("server/auth.ts");
    const routes = read("server/routes.ts");
    const facebookStrategy = auth.slice(
      auth.indexOf("new FacebookStrategy"),
      auth.indexOf("// Serialize/deserialize user for session")
    );
    const googleStrategy = routes.slice(
      routes.indexOf("new GoogleStrategy"),
      routes.indexOf("// Public runtime capability contract for login UI")
    );

    expect(facebookStrategy.indexOf("isReservedSignupIdentityEmail(email)")).toBeLessThan(
      facebookStrategy.indexOf("const newUser = await storage.createUser")
    );
    expect(googleStrategy.indexOf("isReservedSignupIdentityEmail(email)")).toBeLessThan(
      googleStrategy.indexOf("user = await storage.createUser")
    );
  });

  it("does not derive response admin flags or auth-user promotion from reserved emails", () => {
    const routes = read("server/routes.ts");
    const sanitizer = routes.slice(
      routes.indexOf("const sanitizeUserForResponse"),
      routes.indexOf("const coerceToRoutingRoleEnum")
    );
    const authUser = routes.slice(
      routes.indexOf('app.get("/api/auth/user"'),
      routes.indexOf('app.get("/api/auth/setup-status"')
    );
    const workerRoutes = read("server/routes/worker-tasks.ts");
    const workerSanitizer = workerRoutes.slice(
      workerRoutes.indexOf("const sanitizeUserForResponse"),
      workerRoutes.indexOf("export function registerWorkerTasksRoutes")
    );

    expect(sanitizer).not.toContain("ReservedAuthorityEmail");
    expect(sanitizer).not.toContain("AliasEmail");
    expect(authUser).not.toContain("ReservedAuthorityEmail");
    expect(authUser).not.toContain("reconcile super admin alias role");
    expect(workerSanitizer).not.toContain("ReservedAuthorityEmail");
    expect(workerSanitizer).not.toContain("AliasEmail");
  });
});
