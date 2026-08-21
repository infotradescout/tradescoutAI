import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { hashPassword, isAuthenticated } from "../auth";
import { pool } from "../db";
import { storage } from "../storage";
import {
  ensureProfileAccount,
  getProfileAccountState,
  type ProfileAccountRecord,
} from "../services/profileAccountService";
import {
  ensureProfileAccountEntitlement,
  listProfileAccountEntitlements,
  type ProfileAccountEntitlement,
} from "../services/profileAccountEntitlementService";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";

function isSafeInternalPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;
  try {
    const parsed = new URL(value, "https://profile-account.local");
    if (parsed.origin !== "https://profile-account.local") return false;
    return !decodeURIComponent(parsed.pathname).split("/").includes("..");
  } catch {
    return false;
  }
}

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

const createProfileAccountSchema = z
  .object({
    businessName: z.string().trim().min(2).max(160).optional(),
    sourcePath: z.string().trim().max(500).refine(isSafeInternalPath).optional(),
  })
  .strict();

const registerProfileAccountSchema = z
  .object({
    profileSlug: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    businessName: z.string().trim().min(2).max(160),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(320),
    phone: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .refine((value) => value.replace(/\D/g, "").length >= 10, "Enter a valid phone number."),
    password: z
      .string()
      .min(8)
      .max(200)
      .regex(/[A-Z]/, "Add at least one uppercase letter.")
      .regex(/[a-z]/, "Add at least one lowercase letter.")
      .regex(/[0-9]/, "Add at least one number."),
    acceptTerms: z.literal(true),
    sourcePath: z.string().trim().max(500).refine(isSafeInternalPath),
    next: z.string().trim().max(500).refine(isSafeInternalPath),
  })
  .strict();

function getUserId(req: Request): string | null {
  const user = req.user as any;
  const userId = user?.id || user?.claims?.sub;
  const normalized = String(userId || "").trim();
  return normalized || null;
}

async function entitlementsForAccount(args: {
  account: ProfileAccountRecord;
  includesBidRock: boolean;
}): Promise<readonly ProfileAccountEntitlement[]> {
  if (args.includesBidRock) {
    return [
      await ensureProfileAccountEntitlement({
        profileAccountId: args.account.id,
        productKey: "bidrock",
        verificationStatus: args.account.verificationStatus,
      }),
    ];
  }
  return listProfileAccountEntitlements(args.account.id);
}

async function establishSession(req: Request, user: any): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.login(user, (error) => (error ? reject(error) : resolve()));
  });
  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

async function deleteIncompleteIdentity(userId: string): Promise<void> {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  } catch (cleanupError) {
    console.error("[profile-accounts] incomplete registration cleanup failed", cleanupError);
  }
}

export function registerProfileAccountRoutes(app: Express) {
  const registrationLimiter =
    process.env.NODE_ENV === "production"
      ? rateLimit({
          windowMs: 60 * 60 * 1000,
          max: 20,
          standardHeaders: true,
          legacyHeaders: false,
          store: createPostgresRateLimitStore({
            pool,
            prefix: "profile_account_register",
            cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 600_000),
          }),
        })
      : ((_req: Request, _res: Response, next: () => void) => next());

  app.get("/api/u/:slug/account", async (req: Request, res: Response): Promise<void> => {
    try {
      const state = await getProfileAccountState({
        profileSlug: String(req.params.slug || ""),
        userId: getUserId(req),
      });
      if (!state) {
        res.status(404).json({ message: "Profile not found" });
        return;
      }
      const entitlements = state.account
        ? await listProfileAccountEntitlements(state.account.id)
        : [];
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ ...state, entitlements });
    } catch (error) {
      console.error("[profile-accounts] state failed", error);
      res.status(500).json({ message: "Profile account is temporarily unavailable." });
    }
  });

  app.post(
    "/api/profile-accounts/register",
    registrationLimiter,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = registerProfileAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: parsed.error.issues[0]?.message || "Account registration is invalid.",
        });
        return;
      }

      let createdUserId = "";
      try {
        const targetState = await getProfileAccountState({
          profileSlug: parsed.data.profileSlug,
        });
        if (!targetState || !targetState.policy.enabled) {
          res.status(404).json({ message: "Profile account target not found" });
          return;
        }
        if (targetState.policy.requiredIdentity !== "business") {
          res.status(400).json({ message: "This registration path is for business accounts." });
          return;
        }

        const email = normalizeEmail(parsed.data.email);
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          res.status(409).json({
            message: "An account with this email already exists. Sign in to continue.",
            code: "AUTH_ACCOUNT_EXISTS",
          });
          return;
        }

        const now = new Date();
        const user = await storage.createUser({
          email,
          password: await hashPassword(parsed.data.password),
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          phone: parsed.data.phone,
          role: "homeowner" as any,
          roles: ["homeowner"],
          activeRole: "homeowner",
          provider: "local",
          emailVerified: false,
          addressVerified: false,
          verificationStatus: "pending",
          onboardingCompleted: false,
          profileVisibility: "private",
          verifiedBadge: false,
          preferences: {
            profileAccount: {
              profileSlug: parsed.data.profileSlug,
              sourcePath: parsed.data.sourcePath,
              returnPath: parsed.data.next,
              createdAt: now.toISOString(),
            },
            legal: {
              termsOfServiceAcceptedAt: now.toISOString(),
              privacyPolicyAcknowledgedAt: now.toISOString(),
            },
          },
          createdAt: now,
          updatedAt: now,
        } as any);
        createdUserId = String(user.id);

        const created = await ensureProfileAccount({
          userId: createdUserId,
          profileSlug: parsed.data.profileSlug,
          businessName: parsed.data.businessName,
          sourcePath: parsed.data.sourcePath,
        });
        const entitlements = await entitlementsForAccount({
          account: created.account,
          includesBidRock: created.policy.includesBidRock,
        });

        await establishSession(req, user);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(201).json({ ...created, entitlements });
      } catch (error: any) {
        if (createdUserId) await deleteIncompleteIdentity(createdUserId);
        if (String(error?.code || "") === "23505") {
          res.status(409).json({
            message: "An account with this email already exists. Sign in to continue.",
            code: "AUTH_ACCOUNT_EXISTS",
          });
          return;
        }
        console.error("[profile-accounts] registration failed", error);
        res.status(500).json({ message: "Account could not be created. Please try again." });
      }
    }
  );

  app.post(
    "/api/u/:slug/account",
    isAuthenticated,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const userId = getUserId(req);
        if (!userId) {
          res.status(401).json({ message: "Authentication required" });
          return;
        }
        const parsed = createProfileAccountSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({ message: "Profile account request is invalid." });
          return;
        }

        const created = await ensureProfileAccount({
          userId,
          profileSlug: String(req.params.slug || ""),
          businessName: parsed.data.businessName,
          sourcePath: parsed.data.sourcePath,
        });
        const entitlements = await entitlementsForAccount({
          account: created.account,
          includesBidRock: created.policy.includesBidRock,
        });

        res.setHeader("Cache-Control", "private, no-store");
        res.status(201).json({ ...created, entitlements });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Profile account could not be created.";
        if (/business name is required/i.test(message)) {
          res.status(409).json({ message, requiresBusinessSetup: true });
          return;
        }
        const status = /not found/i.test(message)
          ? 404
          : /not available|invalid/i.test(message)
            ? 400
            : /authentication|required|identity/i.test(message)
              ? 401
              : 500;
        if (status === 500) console.error("[profile-accounts] create failed", error);
        res.status(status).json({ message });
      }
    }
  );
}
