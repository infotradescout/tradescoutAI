import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { applyRequestSessionCookieScope, hashPassword, isAuthenticated } from "../auth";
import { pool } from "../db";
import { emailService } from "../services/emailService";
import { emailVerificationService } from "../services/emailVerificationService";
import { passwordResetService } from "../services/passwordResetService";
import { storage } from "../storage";
import {
  applyProfileAccountVerificationBypass,
  ensureProfileAccount,
  getProfileAccountState,
  type ProfileAccountRecord,
} from "../services/profileAccountService";
import {
  applyProfileAccountEntitlementVerificationBypass,
  ensureProfileAccountEntitlement,
  listProfileAccountEntitlements,
  type ProfileAccountEntitlement,
} from "../services/profileAccountEntitlementService";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { hasRequestPrivilegedVerificationBypass } from "../utils/privilegedVerification";

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

function isProfileAccountReturnPath(value: string): boolean {
  if (!isSafeInternalPath(value)) return false;
  try {
    const parsed = new URL(value, "https://profile-account.local");
    if (parsed.searchParams.get("profileAccount") !== "1") return false;
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, "") || "/";
    return pathname === "/jw-stone" || /^\/u\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname);
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

const profileAccountPasswordResetSchema = z
  .object({
    email: z.string().trim().email().max(320),
    next: z.string().trim().max(500).refine(isProfileAccountReturnPath),
  })
  .strict();

function getUserId(req: Request): string | null {
  const user = req.user as any;
  const userId = user?.id || user?.claims?.sub;
  const normalized = String(userId || "").trim();
  return normalized || null;
}

const getPublicBaseUrlFromRequest = (req: Request): string => {
  const configured = String(
    process.env.PUBLIC_WEB_URL || process.env.APP_URL || process.env.APP_BASE_URL || ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Use the request-derived origin outside production.
    }
  }
  if (process.env.NODE_ENV === "production") return "https://www.thetradescout.com";
  const protocol = String(req.get("x-forwarded-proto") || req.protocol || "http")
    .split(",")[0]
    .trim();
  const host = String(req.get("x-forwarded-host") || req.get("host") || "localhost:5000")
    .split(",")[0]
    .trim();
  return `${protocol}://${host}`;
};

const getGeneralSetting = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const settings = await storage.getSiteSettings("general");
    const match = settings.find(
      (setting: any) => setting.key === key && setting.isActive !== false
    );
    return (
      match && typeof (match as any).value !== "undefined" ? (match as any).value : fallback
    ) as T;
  } catch {
    return fallback;
  }
};

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
  applyRequestSessionCookieScope(req);
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
      : (_req: Request, _res: Response, next: () => void) => next();
  const passwordResetLimiter =
    process.env.NODE_ENV === "production"
      ? rateLimit({
          windowMs: 60 * 60 * 1000,
          max: 5,
          standardHeaders: true,
          legacyHeaders: false,
          store: createPostgresRateLimitStore({
            pool,
            prefix: "profile_account_password_reset",
            cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 600_000),
          }),
        })
      : (_req: Request, _res: Response, next: () => void) => next();

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
      const verificationBypassActive = hasRequestPrivilegedVerificationBypass(req);
      const entitlements = state.account
        ? await listProfileAccountEntitlements(state.account.id)
        : [];
      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        ...state,
        account: applyProfileAccountVerificationBypass(state.account, verificationBypassActive),
        verificationBypassActive,
        entitlements: applyProfileAccountEntitlementVerificationBypass(
          entitlements,
          verificationBypassActive
        ),
      });
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
        const registrationEnabled = await getGeneralSetting<boolean>("registration_enabled", true);
        if (!registrationEnabled) {
          res.status(403).json({ message: "Registration is currently disabled" });
          return;
        }

        const emailVerificationRequired = await getGeneralSetting<boolean>(
          "email_verification_required",
          true
        );

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
          emailVerified: emailVerificationRequired ? false : true,
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

        let emailVerificationSent = false;
        let verificationToken: string | undefined;
        if (emailVerificationRequired) {
          const { token, expiresAt } = await emailVerificationService.createToken(user.id);
          const verifyBase = getPublicBaseUrlFromRequest(req);
          const verifyLink = `${verifyBase.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(
            token
          )}&next=${encodeURIComponent(parsed.data.next)}`;

          const verificationMinutes = Math.max(
            1,
            Math.round((Number(expiresAt) - Date.now()) / 60000)
          );
          try {
            const sendResult = await emailService.sendEmail({
              to: email,
              subject: "Verify your TradeScout email",
              html: `<p>Thanks for joining TradeScout.</p>
                 <p><a href="${escapeHtml(verifyLink)}">Verify your email address</a>. This link expires in ${verificationMinutes} minutes.</p>`,
              text: `Verify your TradeScout email: ${verifyLink}`,
              purpose: "account_creation",
            });
            emailVerificationSent = !sendResult.skipped;
          } catch (emailError) {
            console.error("[email-verification] Failed to send verification email:", emailError);
          }

          if (!emailService.isConfigured() && process.env.NODE_ENV !== "production") {
            verificationToken = token;
          }
        }

        await establishSession(req, user);
        res.setHeader("Cache-Control", "private, no-store");
        res.status(201).json({
          ...created,
          entitlements,
          emailVerificationRequired,
          emailVerificationSent,
          ...(verificationToken ? { verificationToken } : {}),
        });
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
    "/api/profile-accounts/request-password-reset",
    passwordResetLimiter,
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
        if (user) {
          const { token, code, expiresAt } = await passwordResetService.createToken(user.id);
          const resetBase = String(
            process.env.PASSWORD_RESET_URL || getPublicBaseUrlFromRequest(req)
          )
            .trim()
            .replace(/\/+$/, "");
          const resetLink = `${resetBase}/reset-password?token=${encodeURIComponent(
            token
          )}&next=${encodeURIComponent(parsed.data.next)}`;
          try {
            await emailService.sendEmail({
              to: email,
              subject: "Reset your TradeScout password",
              html: `<p>We received a request to reset your TradeScout password.</p>
                 <p><a href="${escapeHtml(resetLink)}">Reset your password</a>. This link expires in ${Math.max(
                   1,
                   Math.round((expiresAt - Date.now()) / 60000)
                 )} minutes.</p>
                 <p>Or enter this verification code: <strong>${escapeHtml(code)}</strong></p>
                 <p>If you did not request this, you can ignore this email.</p>`,
              text: `Reset your password: ${resetLink}\nVerification code: ${code}`,
              purpose: "password_reset",
            });
          } catch (emailError) {
            console.error("[profile-accounts] password reset email failed", emailError);
          }
        }
        res.json({ message: genericMessage });
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
        const verificationBypassActive = hasRequestPrivilegedVerificationBypass(req);

        res.setHeader("Cache-Control", "private, no-store");
        res.status(201).json({
          ...created,
          account: applyProfileAccountVerificationBypass(created.account, verificationBypassActive),
          verificationBypassActive,
          entitlements: applyProfileAccountEntitlementVerificationBypass(
            entitlements,
            verificationBypassActive
          ),
        });
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
