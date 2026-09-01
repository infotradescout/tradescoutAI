import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as FacebookStrategy } from "passport-facebook";
import session from "express-session";
import type { Express, Request, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import crypto from "node:crypto";
import { db, pool } from "./db";
import { storage } from "./storage";
import { users, type User } from "@shared/schema";
import {
  getRolePermissions,
  getRoleHierarchyLevel,
  canUserPerformAction,
  userHasBusinessProviderTools,
} from "@shared/roles";
import type { UserRole } from "@shared/roles";
import { desc, sql } from "drizzle-orm";
import { isReservedSignupIdentityEmail } from "./utils/authorityPolicy";
import { isOutcomeOnboardingComplete } from "@shared/onboardingCompletion";

function normalizeLegacyRole(role: unknown): UserRole | null {
  if (typeof role !== "string" || role.trim().length === 0) return null;
  const normalized = role.trim().toLowerCase();
  // Legacy bootstrap accounts can still carry "owner"/"head_admin"; treat as top-level admin.
  if (normalized === "owner" || normalized === "head_admin") return "super_admin";
  return normalized as UserRole;
}

function parseCookieDomain(): string | undefined {
  const configured = String(process.env.SESSION_COOKIE_DOMAIN || "").trim();
  if (configured) return configured;

  // Default for primary production host: share session across apex + www.
  // This prevents "logged in on thetradescout.com but not www.thetradescout.com" behavior.
  if (process.env.NODE_ENV !== "production") return undefined;

  // Prefer an explicit PUBLIC_WEB_URL if available, but do not require it.
  // In production we always want a single cookie domain for the main site.
  const publicWebUrl = String(process.env.PUBLIC_WEB_URL || "").trim();
  if (publicWebUrl) {
    try {
      const host = new URL(publicWebUrl).hostname.toLowerCase();
      if (host === "thetradescout.com" || host === "www.thetradescout.com") {
        return ".thetradescout.com";
      }
    } catch {
      // ignore
    }
  }

  // Fail-safe default: production cookies should be valid on both apex + www.
  return ".thetradescout.com";
}

// Configure session
export function getSession() {
  const sessionTtlMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  const sessionTtlSeconds = 7 * 24 * 60 * 60;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool: pool,
    createTableIfMissing: true,
    ttl: sessionTtlSeconds,
    tableName: "sessions",
  });

  let sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET is missing");
    }
    console.warn(
      "[Auth] SESSION_SECRET missing in dev; using insecure fallback. DO NOT USE THIS CONFIGURATION IN PRODUCTION."
    );
    sessionSecret = "dev-insecure-session-secret";
  }

  const isProductionEnv = process.env.NODE_ENV === "production";
  const configuredSameSite = String(process.env.SESSION_COOKIE_SAMESITE || "")
    .trim()
    .toLowerCase();
  const sameSiteCookie: "lax" | "strict" | "none" =
    configuredSameSite === "lax" || configuredSameSite === "strict" || configuredSameSite === "none"
      ? (configuredSameSite as "lax" | "strict" | "none")
      : isProductionEnv
        ? "none"
        : "lax";

  const cookieDomain = parseCookieDomain();

  return session({
    name: "tradescout.sid",
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      // Production defaults to secure cookies for OAuth/API split-host setups.
      // Dev stays http-friendly.
      secure: isProductionEnv,
      sameSite: sameSiteCookie,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
      maxAge: sessionTtlMs,
    },
  });
}

// Initialize authentication
function isPrimaryAppHost(host: string): boolean {
  return (
    host === "thetradescout.com" ||
    host.endsWith(".thetradescout.com") ||
    host.endsWith(".onrender.com") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export function applyRequestSessionCookieScope(req: Request): void {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .toLowerCase()
    .split(",")[0]
    .trim()
    .split(":")[0];

  if (req.session && host && !isPrimaryAppHost(host)) {
    req.session.cookie.domain = undefined;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  // A business's custom domain (e.g. jwstonelogistics.com) is a different
  // browser origin from thetradescout.com, so a cookie scoped to
  // `.thetradescout.com` is never sent there — logging in on that domain
  // would silently fail to persist a session. Downgrade to a host-only
  // cookie for any request that didn't land on a thetradescout.com host, so
  // login/session works natively wherever a profile is actually being viewed.
  app.use((req, _res, next) => {
    applyRequestSessionCookieScope(req);
    next();
  });
  app.use(passport.initialize());
  app.use(passport.session());

  // Local strategy for email/password authentication
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const normalizedEmail = String(email || "")
          .trim()
          .toLowerCase();

        if (!normalizedEmail || !password) {
          return done(null, false, {
            message: "Email and password are required",
            code: "AUTH_MISSING_FIELDS",
          } as any);
        }

        const user = await storage.getUserByEmail(normalizedEmail);
        if (!user) {
          return done(null, false, {
            message: "No account found for this email",
            code: "AUTH_NO_ACCOUNT",
          } as any);
        }

        if (!user.password) {
          return done(null, false, {
            message:
              "This account uses social login. Sign in with Google/Facebook or reset your password.",
            code: "AUTH_SOCIAL_ONLY",
          } as any);
        }

        const normalizeHash = (hash: string): string => {
          // Legacy stores occasionally persist wrapped or prefixed bcrypt strings.
          // Normalize those cases before compare.
          let normalized = String(hash || "").trim();

          if (normalized.startsWith('"') && normalized.endsWith('"')) {
            try {
              const parsed = JSON.parse(normalized);
              if (typeof parsed === "string") {
                normalized = parsed.trim();
              }
            } catch {
              // Keep original string if it is not valid JSON.
            }
          }

          normalized = normalized.replace(/^bcrypt:/i, "");

          // Some legacy imports use PHP-style $2y$ / $2x$ prefixes; node bcrypt expects $2a$/$2b$.
          normalized = normalized.replace(/^\$2y\$/, "$2b$").replace(/^\$2x\$/, "$2b$");

          return normalized.trim();
        };

        const safeTimingEquals = (a: string, b: string): boolean => {
          // Avoid leaking timing on legacy/plaintext comparisons.
          const aBuf = Buffer.from(String(a), "utf8");
          const bBuf = Buffer.from(String(b), "utf8");
          if (aBuf.length !== bBuf.length) return false;
          return crypto.timingSafeEqual(aBuf, bBuf);
        };

        const safeCompare = async (
          candidate: string,
          hash: string,
          userIdForRepair?: string
        ): Promise<boolean> => {
          try {
            const normalizedHash = normalizeHash(hash);

            // If the stored "hash" isn't a bcrypt string (legacy plaintext / bad import),
            // treat it as plaintext only if it matches exactly, then repair by re-hashing.
            const looksLikeBcrypt = /^\$2[aby]\$/.test(normalizedHash);
            if (!looksLikeBcrypt) {
              if (!safeTimingEquals(candidate, normalizedHash)) return false;

              if (userIdForRepair) {
                try {
                  const repairedHash = await bcrypt.hash(candidate, 12);
                  await storage.updateUser(userIdForRepair, {
                    password: repairedHash,
                    updatedAt: new Date(),
                  });
                } catch {
                  // If repair fails, still allow login (password matched) to avoid locking out.
                }
              }
              return true;
            }

            return await bcrypt.compare(candidate, normalizedHash);
          } catch {
            return false;
          }
        };

        const candidatePasswords = Array.from(
          new Set([String(password), String(password).trim()].filter((p) => p.length > 0))
        );

        const candidateMatchesUser = async (candidateUser: Pick<User, "id" | "password">) => {
          if (!candidateUser?.password) return false;
          for (const candidate of candidatePasswords) {
            if (await safeCompare(candidate, candidateUser.password, candidateUser.id)) {
              return true;
            }
          }
          return false;
        };

        let matchedUser: User | null = null;
        const checkedUserIds = new Set<string>();
        let duplicateEmailCandidates: User[] = [];

        if (await candidateMatchesUser(user)) {
          matchedUser = user;
          checkedUserIds.add(user.id);
        } else {
          checkedUserIds.add(user.id);

          // Recover from case-insensitive duplicate email rows by checking all candidates.
          duplicateEmailCandidates = await db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${normalizedEmail}`)
            .orderBy(desc(users.updatedAt), desc(users.createdAt))
            .limit(10);

          for (const candidateUser of duplicateEmailCandidates) {
            if (!candidateUser?.id || checkedUserIds.has(candidateUser.id)) continue;
            checkedUserIds.add(candidateUser.id);
            if (await candidateMatchesUser(candidateUser)) {
              matchedUser = candidateUser;
              break;
            }
          }
        }

        if (!matchedUser) {
          const configuredMasterAdminEmail = String(process.env.MASTER_ADMIN_EMAIL || "")
            .trim()
            .toLowerCase();
          const configuredMasterAdminPassword = String(process.env.MASTER_ADMIN_PASSWORD || "");

          const matchesConfiguredMasterPassword =
            configuredMasterAdminPassword.length > 0 &&
            candidatePasswords.some((candidate) => candidate === configuredMasterAdminPassword);

          if (matchesConfiguredMasterPassword) {
            const masterCandidates = [user, ...duplicateEmailCandidates];
            const healedUser = masterCandidates.find((candidateUser) => {
              const isSuperAdminLikeRole =
                normalizeLegacyRole(candidateUser?.role) === "super_admin";
              if (!isSuperAdminLikeRole) return false;
              if (!configuredMasterAdminEmail) return true;
              return (
                String(candidateUser?.email || "")
                  .trim()
                  .toLowerCase() === configuredMasterAdminEmail
              );
            });

            if (healedUser) {
              try {
                const refreshedHash = await bcrypt.hash(configuredMasterAdminPassword, 10);
                await storage.updateUser(healedUser.id, {
                  password: refreshedHash,
                  updatedAt: new Date(),
                });
                return done(null, healedUser);
              } catch (repairError) {
                return done(repairError as Error);
              }
            }
          }

          return done(null, false, {
            message: "Incorrect password",
            code: "AUTH_INCORRECT_PASSWORD",
          } as any);
        }

        return done(null, matchedUser);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Facebook strategy for social authentication
  const facebookDisabled = process.env.DISABLE_FACEBOOK_AUTH === "true";
  const facebookAppId = process.env.FACEBOOK_APP_ID || process.env.FACEBOOK_CLIENT_ID;
  const facebookAppSecret = process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET;

  console.log("FACEBOOK ENV CHECK", {
    id: facebookAppId,
    secret: !!facebookAppSecret,
    callback: process.env.FACEBOOK_CALLBACK_URL,
    disable: process.env.DISABLE_FACEBOOK_AUTH,
  });

  if (facebookDisabled || !facebookAppId || !facebookAppSecret) {
    console.log(
      "Facebook strategy skipped (set FACEBOOK_APP_ID/SECRET or FACEBOOK_CLIENT_ID/CLIENT_SECRET to enable; set DISABLE_FACEBOOK_AUTH=true to silence this message)"
    );
  } else {
    const canonicalWebOrigin = String(
      process.env.PUBLIC_WEB_URL || process.env.APP_URL || "https://www.thetradescout.com"
    ).replace(/\/+$/, "");
    const defaultFacebookCallbackURL = `${canonicalWebOrigin}/api/auth/facebook/callback`;
    const configuredFacebookCallback = String(process.env.FACEBOOK_CALLBACK_URL || "").trim();
    const facebookCallbackURL =
      process.env.NODE_ENV === "production" &&
      /onrender\.com/i.test(configuredFacebookCallback) &&
      canonicalWebOrigin.startsWith("https://")
        ? defaultFacebookCallbackURL
        : configuredFacebookCallback || defaultFacebookCallbackURL;

    console.log("[AUTH] Using Facebook callback URL:", facebookCallbackURL);
    console.log(
      "Registering Facebook strategy with App ID:",
      facebookAppId.substring(0, 4) + "..."
    );
    try {
      passport.use(
        "facebook",
        new FacebookStrategy(
          {
            clientID: facebookAppId,
            clientSecret: facebookAppSecret,
            callbackURL: facebookCallbackURL,
            profileFields: ["id", "displayName", "photos", "email", "first_name", "last_name"],
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              let user = await storage.getUserByFacebookId(profile.id);

              if (user) {
                return done(null, user);
              }

              const email = profile.emails?.[0]?.value;
              if (email) {
                user = await storage.getUserByEmail(email);
                if (user) {
                  await storage.updateUser(user.id, {
                    facebookId: profile.id,
                    profileImageUrl: profile.photos?.[0]?.value,
                  });
                  return done(null, user);
                }

                // Configured authority addresses are recovery candidates, not
                // public signup identifiers. Existing persisted users may use
                // their configured provider; a new account may not claim one.
                if (isReservedSignupIdentityEmail(email)) {
                  return done(null, false, {
                    message: "Unable to create an account with this sign-in method",
                    code: "AUTH_ACCOUNT_EXISTS",
                  } as any);
                }
              }

              const newUser = await storage.createUser({
                email: email || `${profile.id}@facebook.local`,
                firstName: profile.name?.givenName || profile.displayName,
                lastName: profile.name?.familyName || "",
                profileImageUrl: profile.photos?.[0]?.value,
                facebookId: profile.id,
                role: null,
                // Email verification must be completed via the in-product workflow,
                // regardless of signup method (local or OAuth).
                emailVerified: false,
                onboardingCompleted: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              });

              return done(null, newUser);
            } catch (error) {
              return done(error);
            }
          }
        )
      );
      console.log("Facebook strategy successfully registered");
    } catch (error) {
      console.error("Error registering Facebook strategy:", error);
    }
  }

  // Serialize/deserialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });
}

// Authentication middleware
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    try {
      const user = req.user as User | undefined;
      const userId = user?.id;
      const anySession = req.session as any;
      const todayKey = new Date().toISOString().slice(0, 10);

      if (userId) {
        if (
          !anySession?.lastSessionStartedDayKey ||
          anySession.lastSessionStartedDayKey !== todayKey
        ) {
          anySession.lastSessionStartedDayKey = todayKey;
          storage.logEvent("user.session_started", { userId }).catch((err: any) => {
            console.error("Failed to log user.session_started", err);
          });
        }
      }
    } catch (err) {
      console.error("Error handling user.session_started logging", err);
    }

    return next();
  }

  res.status(401).json({ message: "Authentication required" });
};

// Onboarding completion guard: one explicit outcome-completion authority.
export const requireOnboardingComplete: RequestHandler = (req, res, next) => {
  const user = req.user as User | undefined;

  const anyUser: any = user || {};

  // Persisted admin roles/flags may bypass onboarding gates.
  const normalizedRole = normalizeLegacyRole(anyUser.role);
  if (
    normalizedRole === "super_admin" ||
    anyUser.isAdmin === true ||
    anyUser.isSuperAdmin === true
  ) {
    return next();
  }

  if (user && isOutcomeOnboardingComplete(anyUser)) {
    return next();
  }

  return res.status(403).json({
    code: "ONBOARDING_REQUIRED",
    redirect: "/onboarding/profile",
  });
};

// Enhanced role-based authorization middleware with hierarchy support
export const requireRole = (allowedRoles: UserRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = (req.user || {}) as any as User & {
      activeRole?: unknown;
      roles?: unknown;
      isAdmin?: unknown;
    };

    const primaryRole = normalizeLegacyRole((user as any).role);
    const activeRole = normalizeLegacyRole((user as any).activeRole);
    const roleListRaw = Array.isArray((user as any).roles)
      ? ((user as any).roles as unknown[])
      : [];
    const roleList = roleListRaw
      .map((role) => normalizeLegacyRole(role))
      .filter(Boolean) as UserRole[];

    const isAdminFlag = (user as any).isAdmin === true || (user as any).isSuperAdmin === true;

    const candidateRoles = new Set<UserRole>();
    if (primaryRole) candidateRoles.add(primaryRole);
    if (activeRole) candidateRoles.add(activeRole);
    roleList.forEach((role) => candidateRoles.add(role));
    // Persisted flags still grant access through role gates when present.
    if (isAdminFlag) candidateRoles.add("super_admin");

    if (candidateRoles.size === 0) {
      return res.status(403).json({ message: "No role assigned" });
    }

    const userLevel = Math.max(
      ...Array.from(candidateRoles).map((role) => getRoleHierarchyLevel(role))
    );
    const hasPermission = allowedRoles.some((role) => {
      const requiredLevel = getRoleHierarchyLevel(role);
      return userLevel >= requiredLevel;
    });

    if (!hasPermission) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

// Permission-based authorization middleware
export const requirePermission = (
  permission: keyof ReturnType<typeof getRolePermissions>
): RequestHandler => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as User;
    const userRole = normalizeLegacyRole(user.role);

    if (!userRole) {
      return res.status(403).json({ message: "No role assigned" });
    }

    const permissions = getRolePermissions(userRole);
    if (!permissions[permission]) {
      return res.status(403).json({ message: `Permission denied: ${permission}` });
    }

    next();
  };
};

// Specific role middleware with hierarchy
export const isAdmin: RequestHandler = requireRole(["moderator", "ops_admin", "super_admin"]);
// Backward-compat: some legacy routes imported `isHeadAdmin`; it now matches `super_admin`.
export const isHeadAdmin: RequestHandler = requireRole(["super_admin"]);
export const isSuperAdmin: RequestHandler = requireRole(["super_admin"]);
export const isModerator: RequestHandler = requireRole(["moderator", "ops_admin", "super_admin"]);
export const isStaff: RequestHandler = requireRole([
  "support_agent",
  "content_moderator",
  "territory_manager",
  "contractor_success",
  "content_seo",
  "analytics_specialist",
  "marketing_specialist",
  "moderator",
  "ops_admin",
  "super_admin",
]);
export const isBusinessProvider: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = (req.user || {}) as any;
  const isAdminFlag = user.isAdmin === true || user.isSuperAdmin === true;
  const normalizedRoles = [
    normalizeLegacyRole(user.role),
    normalizeLegacyRole(user.activeRole),
    ...(Array.isArray(user.roles)
      ? user.roles.map((role: unknown) => normalizeLegacyRole(role))
      : []),
  ].filter(Boolean);
  const hasAdminRole = normalizedRoles.some((role) =>
    ["moderator", "ops_admin", "super_admin"].includes(String(role))
  );

  if (isAdminFlag || hasAdminRole || userHasBusinessProviderTools(user)) {
    return next();
  }

  return res.status(403).json({ message: "Business provider access required" });
};
export const isContractor: RequestHandler = isBusinessProvider;
export const isCommunityModerator: RequestHandler = requireRole([
  "community_moderator",
  "community_leader",
  "moderator",
  "ops_admin",
  "super_admin",
]);

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  const configuredRounds = Number(process.env.BCRYPT_SALT_ROUNDS);
  const saltRounds = Number.isFinite(configuredRounds)
    ? Math.max(4, Math.min(15, Math.trunc(configuredRounds)))
    : process.env.NODE_ENV === "test"
      ? 4
      : 12;
  return bcrypt.hash(password, saltRounds);
}

export async function validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Master admin setup function
// Middleware to require authentication
export const requireAuth = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Authentication required" });
};

// Middleware to require admin role
export const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = req.user || {};
  const activeRole = typeof user.activeRole === "string" ? user.activeRole : "";
  const primaryRole = typeof user.role === "string" ? user.role : "";
  const roles = Array.isArray(user.roles) ? user.roles.map((r: any) => String(r)) : [];
  const isAdminFlag = user.isAdmin === true || user.isSuperAdmin === true;

  const adminRoles = new Set(["moderator", "ops_admin", "super_admin"]);
  const normalizedPrimaryRole = normalizeLegacyRole(primaryRole) || primaryRole;
  const normalizedActiveRole = normalizeLegacyRole(activeRole) || activeRole;
  const normalizedRoles = roles.map((role: string) => normalizeLegacyRole(role) || role);
  const hasAdminRole =
    adminRoles.has(normalizedActiveRole) ||
    adminRoles.has(normalizedPrimaryRole) ||
    normalizedRoles.some((role: string) => adminRoles.has(role));

  if (isAdminFlag || hasAdminRole) {
    return next();
  }

  return res.status(403).json({ error: "Admin access required" });
};

export async function createMasterAdmin(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<User> {
  const passwordHash = await hashPassword(password);

  return storage.createUser({
    email,
    password: passwordHash,
    firstName,
    lastName,
    role: "super_admin",
    emailVerified: true,
    addressVerified: true, // Master admin bypasses verification
    onboardingCompleted: true,
  });
}
