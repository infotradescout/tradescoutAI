import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { buildProfileAccountReturnPath } from "@shared/profileAccount";
import { hashPassword, isAuthenticated } from "../auth";
import { pool } from "../db";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { emailVerificationService } from "../services/emailVerificationService";
import { passwordResetService } from "../services/passwordResetService";
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

function isSafeSourcePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;
  try {
    const parsed = new URL(value, "https://profile-account.local");
    if (parsed.origin !== "https://profile-account.local") return false;
    const decodedPath = decodeURIComponent(parsed.pathname);
    return !decodedPath.split("/").includes("..");
  } catch {
    return false;
  }
}

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function publicWebOrigin(req: Request): string {
  const configured = String(
    process.env.PUBLIC_WEB_URL || process.env.APP_URL || process.env.APP_BASE_URL || ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to a request-derived origin outside production.
    }
  }
  if (process.env.NODE_ENV === "production") return "https://www.thetradescout.com";
  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost")
    .split(",")[0]
    .trim();
  return `${forwardedProto}://${forwardedHost}`;
}

async function getGeneralSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const settings = await storage.getSiteSettings("general");
    const match = settings.find((setting) => setting.key === key && setting.isActive !== false);
    if (match && typeof (match as any).value !== "undefined") {
      return (match as any).value as T;
    }
  } catch (error) {
    console.warn(`[profile-accounts] unable to read ${key}; using fallback`, error);
  }
  return fallback;
}

const createProfileAccountSchema = z
  .object({
    businessName: z.string().trim().min(2).max(160).optional(),
    sourcePath: z.string().trim().max(500).refine(isSafeSourcePath).optional(),
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
    sourcePath: z.string().trim().max(500).refine(isSafeSourcePath),
    next: z.string().trim().max(500).refine(isSafeSourcePath),
  })
  .strict();

const profileAccountPasswordResetSchema = z
  .object({
    email: z.string().trim().email().max(320),
    next: z.string().trim().max(500).refine(isSafeSourcePath),
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

async function deleteNewIdentity(userId: string): Promise<void> {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
  } catch (cleanupError) {
    console.error("[profile-accounts] failed to clean up incomplete registration", cleanupError);
  }
}

export function registerProfileAccountRoutes(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";
  const noopLimiter: any = (_req: Request, _res: Response, next: () => void) => next();
  const registrationLimiter = isProduction
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
    : noopLimiter;
  const resetLimiter = isProduction
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        store: createPostgresRateLimitStore({
          pool,
          prefix: "profile_account_password_reset",
          cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 600_000),
        }),
      })
    : noopLimiter;

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
          message: parsed.error.issues[0]?.message || "Profile account registration is invalid.",
        });
        return;
      }

      let createdUserId = "";
      try {
        const registrationEnabled = await getGeneralSetting<boolean>("registration_enabled", true);
        if (!registrationEnabled) {
          res.status(403).json({ message: "Registration is currently disabled" });
          return;
        }

        const targetState = await getProfileAccountState({ profileSlug: parsed.data.profileSlug });
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

        const emailVerificationRequired = await getGeneralSetting<boolean>(
          "email_verification_required",
          true
        );
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
          emailVerified: !emailVerificationRequired,
          addressVerified: false,
          verificationStatus: "pending",
          onboardingCompleted: false,
          profileVisibility: "private",
          verifiedBadge: false,
          preferences: {
            profileAccount: {
              profileSlug: parsed.data.profileSlug,
              sourcePath: parsed.data.sourcePath,
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

        let emailVerificationSent = false;
        let verificationToken: string | undefined;
        if (emailVerificationRequired && !user.emailVerified) {
          const { token, expiresAt } = emailVerificationService.createToken(createdUserId);
          const verifyLink = `${publicWebOrigin(req)}/verify-email?token=${encodeURIComponent(token)}&next=${encodeURIComponent(parsed.data.next)}`;
          try {
            const sendResult = await emailService.sendEmail({
              to: email,
              subject: `Verify your email for ${created.account.profileName}`,
              html: `<p>Verify your email to finish setting up your account with ${escapeHtml(
                created.account.profileName
              )}.</p><p><a href="${escapeHtml(verifyLink)}">Verify your email address</a>. This link expires in ${Math.max(
                1,
                Math.round((expiresAt - Date.now()) / 60000)
              )} minutes.</p>`,
              text: `Verify your email for ${created.account.profileName}: ${verifyLink}`,
              purpose: "account_creation",
            });
            emailVerificationSent = !sendResult.skipped;
          } catch (emailError) {
            console.error("[profile-accounts] verification email failed", emailError);
          }
          if (!emailService.isConfigured() && process.env.NODE_ENV !== "production") {
            verificationToken = token;
          }
        }

        res.setHeader("Cache-Control", "private, no-store");
        res.status(201).json({
          ...created,
          entitlements,
          emailVerificationRequired,
          emailVerificationSent,
          ...(verificationToken ? { verificationToken } : {}),
        });
      } catch (error: any) {
        if (createdUserId) await deleteNewIdentity(createdUserId);
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
    "/api/profile-accounts/request-password-reset",
    resetLimiter,
    async (req: Request, res: Response): Promise<void> => {
      const genericMessage = "If an account exists for that email, a reset link has been sent.";
      const parsed = profileAccountPasswordResetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Enter a valid email address." });
        return;
      }
      try {
        const email = normalizeEmail(parsed.data.email);
        const user = await storage.getUserByEmail(email);
        if (!user) {
          res.json({ message: genericMessage });
          return;
        }

        const { token, code, expiresAt } = passwordResetService.createToken(user.id);
        const resetLink = `${publicWebOrigin(req)}/reset-password?token=${encodeURIComponent(
          token
        )}&next=${encodeURIComponent(parsed.data.next)}`;
        try {
          await emailService.sendEmail({
            to: email,
            subject: "Reset your password",
            html: `<p>Use the link below to set a password and return to the business account you were opening.</p><p><a href="${escapeHtml(
              resetLink
            )}">Set your password</a></p><p>Verification code: <strong>${escapeHtml(
              code
            )}</strong></p><p>This link expires in ${Math.max(
              1,
              Math.round((expiresAt - Date.now()) / 60000)
            )} minutes.</p>`,
            text: `Set your password: ${resetLink}\nVerification code: ${code}`,
            purpose: "account_creation",
          });
        } catch (emailError) {
          console.error("[profile-accounts] password reset email failed", emailError);
        }
        res.json({
          message: genericMessage,
          ...(!emailService.isConfigured() && process.env.NODE_ENV !== "production"
            ? { debugCode: code }
            : {}),
        });
      } catch (error) {
        console.error("[profile-accounts] password reset request failed", error);
        res.json({ message: genericMessage });
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
