import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db";
import { isAuthenticated, isSuperAdmin } from "../auth";
import {
  businesses,
  profiles,
  users,
  workRequestAssignments,
  workRequestEvents,
  workRequests,
} from "@shared/schema";
import { storage } from "../storage";
import { emailService } from "../services/emailService";
import { emailVerificationService } from "../services/emailVerificationService";
import { passwordResetService } from "../services/passwordResetService";
import { notificationService } from "../notification-service";
import { notifySuperAdminsOfDirectConnectRequest } from "../services/directConnectBetaOversight";
import {
  getJrsProvisionedDirectContact,
  JRS_PROFILE_PROVISIONING_SOURCE,
  JRS_PROFILE_SLUG,
} from "../services/jrsAutoGlassProfileProvisioning";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { redactContactDetails } from "../utils/workRequestShare";

type OptionalAuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; [key: string]: any };
};

const EXPRESS_REQUEST_TYPES = [
  "request_material",
  "match_project",
  "ask_about_bundle",
  "schedule_showroom",
  "request_service",
  "request_quote",
  "ask_question",
  "schedule_service",
  "other",
] as const;

const revealSchema = z.object({
  authorityGate: z.literal("profile_direct_connect"),
  decision: z.literal("call"),
});

const requestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(320),
    phone: z
      .string()
      .trim()
      .min(10)
      .max(40)
      .refine((value) => {
        const digits = value.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 15;
      }, "Enter a complete phone number."),
    requestType: z.enum(EXPRESS_REQUEST_TYPES),
    message: z.string().trim().min(10).max(3000),
    stoneName: z.string().trim().max(180).optional(),
    // Quiet bot trap. Real browsers never populate this hidden field.
    website: z.string().max(0).optional(),
  })
  .strict();

type TradePartnerTarget = {
  profileId: string;
  profileSlug: string;
  businessId: string;
  businessName: string;
  ownerUserId: string;
  phone: string;
  // Where new-request emails go. Separate from the owner's login email --
  // a business may want requests routed to a shared inbox instead of
  // whatever address the account owner personally signed in with.
  notificationEmail: string;
};

function normalizeEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePhoneForTel(raw: unknown): { display: string; tel: string } | null {
  const display = String(raw || "").trim();
  const digits = display.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  const e164 =
    digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits.startsWith("1")
        ? `+${digits}`
        : `+${digits}`;
  return { display, tel: `tel:${e164}` };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "TradeScout",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

function requestTitle(requestType: (typeof EXPRESS_REQUEST_TYPES)[number], businessName: string) {
  const labels: Record<(typeof EXPRESS_REQUEST_TYPES)[number], string> = {
    request_material: "Material request",
    match_project: "Stone selection for a project",
    ask_about_bundle: "Bundle availability request",
    schedule_showroom: "Showroom visit request",
    request_service: "Service request",
    request_quote: "Quote request",
    ask_question: "Business question",
    schedule_service: "Service scheduling request",
    other: "Direct request",
  };
  return `${labels[requestType]} for ${businessName}`.slice(0, 180);
}

async function resolveTradePartnerTarget(slug: string): Promise<TradePartnerTarget | null> {
  const normalizedSlug = String(slug || "")
    .trim()
    .toLowerCase();
  if (!normalizedSlug) return null;

  const [row] = await db
    .select({
      profileId: profiles.id,
      profileSlug: profiles.slug,
      profileStatus: profiles.status,
      ownerUserId: profiles.ownerUserId,
      businessId: businesses.id,
      businessName: businesses.name,
      businessStatus: businesses.status,
      businessOwnerUserId: businesses.ownerUserId,
      businessPublicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
      businessSources: businesses.sources,
      profileData: businesses.profileData,
      ownerEmail: users.email,
      ownerPhone: users.phone,
      ownerVerifiedBadge: users.verifiedBadge,
      ownerVerificationStatus: users.verificationStatus,
    })
    .from(profiles)
    .innerJoin(businesses, eq(profiles.businessId, businesses.id))
    .innerJoin(users, eq(profiles.ownerUserId, users.id))
    .where(eq(profiles.slug, normalizedSlug))
    .limit(1);

  const verificationStatus = String(row?.ownerVerificationStatus || "").toLowerCase();
  const ownerDiscoverable = row?.ownerVerifiedBadge === true || verificationStatus === "approved";
  const profileData = (row?.profileData || {}) as Record<string, any>;
  const ownerConfirmedManagedProfile =
    row?.profileSlug === JRS_PROFILE_SLUG &&
    String(row?.businessStatus) === "active" &&
    row?.businessPublicDiscoveryEnabled === false &&
    String(row?.businessOwnerUserId || "") === String(row?.ownerUserId || "") &&
    Array.isArray(row?.businessSources) &&
    row.businessSources.includes(JRS_PROFILE_PROVISIONING_SOURCE);
  if (
    !row ||
    String(row.profileStatus) !== "published" ||
    String(row.businessStatus) !== "active" ||
    (!ownerDiscoverable && !ownerConfirmedManagedProfile)
  ) {
    return null;
  }

  const managedProvisionedContact = ownerConfirmedManagedProfile
    ? getJrsProvisionedDirectContact()
    : null;
  const verifiedOwnerPhone = ownerDiscoverable ? row?.ownerPhone : "";
  const verifiedOwnerEmail = ownerDiscoverable ? row?.ownerEmail : "";
  const phone = String(
    profileData.phone || verifiedOwnerPhone || managedProvisionedContact?.phone || ""
  ).trim();
  const notificationEmail = String(
    profileData.notificationEmail ||
      profileData.email ||
      verifiedOwnerEmail ||
      managedProvisionedContact?.notificationEmail ||
      ""
  ).trim();

  return {
    profileId: String(row.profileId),
    profileSlug: String(row.profileSlug),
    businessId: String(row.businessId),
    businessName: String(row.businessName),
    ownerUserId: String(row.ownerUserId),
    phone,
    notificationEmail,
  };
}

export function registerTradePartnerExpressRoutes(app: Express) {
  const isProduction = process.env.NODE_ENV === "production";
  const noopLimiter: any = (_req: Request, _res: Response, next: () => void) => next();
  const store = (prefix: string) =>
    createPostgresRateLimitStore({
      pool,
      prefix,
      cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 600_000),
    });
  const keyGenerator = (req: OptionalAuthedRequest) => {
    const userId = req.user?.id || req.user?.claims?.sub;
    return userId ? `u:${userId}` : String(req.ip || "unknown");
  };
  const revealLimiter = isProduction
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        store: store("tradepartner_express_reveal"),
      })
    : noopLimiter;
  const submitLimiter = isProduction
    ? rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 8,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator,
        store: store("tradepartner_express_submit"),
      })
    : noopLimiter;

  // Clicking Direct Connect records intent; choosing Call is the decision.
  // Only then is the number returned. It never appears in the public profile.
  app.post(
    "/api/tradepartner-profiles/:slug/express-contact/reveal",
    revealLimiter,
    async (req: OptionalAuthedRequest, res: Response) => {
      try {
        const parsed = revealSchema.safeParse(req.body ?? {});
        if (!parsed.success) return res.status(400).json({ message: "Choose a contact option." });
        const target = await resolveTradePartnerTarget(req.params.slug);
        if (!target) return res.status(404).json({ message: "Profile not found." });
        const phone = normalizePhoneForTel(target.phone);
        if (!phone) return res.status(404).json({ message: "Calling is unavailable right now." });

        console.info("[tradepartner-express] phone revealed after profile decision", {
          profileId: target.profileId,
          businessId: target.businessId,
          source: "tradepartner_profile",
          connectionMode: "express",
          actor: req.user?.id || req.user?.claims?.sub || "anonymous",
          requestId: (req as any).requestId || null,
        });
        return res.json({
          businessName: target.businessName,
          phone: phone.display,
          tel: phone.tel,
        });
      } catch (error) {
        console.error("[tradepartner-express] phone reveal failed", error);
        return res.status(500).json({ message: "Calling is unavailable right now." });
      }
    }
  );

  app.post(
    "/api/tradepartner-profiles/:slug/express-request",
    submitLimiter,
    async (req: OptionalAuthedRequest, res: Response) => {
      try {
        const parsed = requestSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({
            message: "Enter your name, email, phone number, and request details.",
            issues: parsed.error.flatten(),
          });
        }
        const target = await resolveTradePartnerTarget(req.params.slug);
        if (!target) return res.status(404).json({ message: "Profile not found." });

        const body = parsed.data;
        const email = normalizeEmail(body.email);
        const { firstName, lastName } = splitName(body.name);
        const viewerId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        let requester = viewerId ? await storage.getUser(viewerId) : null;
        if (!requester) requester = await storage.getUserByEmail(email);
        const requesterWasCreated = !requester;
        if (!requester) {
          requester = await storage.createUser({
            email,
            firstName,
            lastName,
            phone: body.phone,
            role: "homeowner" as any,
            roles: ["homeowner"],
            activeRole: "homeowner",
            provider: "express_profile",
            emailVerified: false,
            addressVerified: false,
            onboardingCompleted: false,
            preferences: {
              provisional: {
                userTypes: ["homeowner"],
                source: "tradepartner_profile_express_request",
                capturedAt: new Date().toISOString(),
              },
            },
          } as any);
        } else if (viewerId) {
          // Only mutate an existing account when the visitor owns the current
          // authenticated session. A logged-out email match may receive the
          // request, but cannot silently replace that member's profile data.
          const updates: Record<string, any> = {};
          if (!requester.firstName) updates.firstName = firstName;
          if (!requester.lastName && lastName) updates.lastName = lastName;
          if (!requester.phone) updates.phone = body.phone;
          if (Object.keys(updates).length > 0) {
            requester = await storage.updateUser(String(requester.id), updates);
          }
        }

        const sanitizedMessage = redactContactDetails(body.message).trim();
        const title = requestTitle(body.requestType, target.businessName);
        const now = new Date();
        const [created] = await db.transaction(async (tx: any) => {
          const [request] = await tx
            .insert(workRequests)
            .values({
              createdByUserId: String(requester.id),
              title,
              description: sanitizedMessage,
              category: "business_request",
              scope: "personal",
              source: "direct_connect",
              sourceRefId: target.profileId,
              status: "routed",
              visibility: "private",
              exposureMode: "guided",
              competitionMode: "none",
            })
            .returning();

          await tx.insert(workRequestAssignments).values({
            workRequestId: request.id,
            contractorId: null,
            responderUserId: target.ownerUserId,
            status: "invited",
            scoreSnapshot: {
              routingMode: "tradepartner_profile_express",
              reasons: ["Visitor selected this business from its clean profile link."],
            },
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(workRequestEvents).values([
            {
              workRequestId: request.id,
              type: "created",
              actorUserId: String(requester.id),
              metadata: {
                source: "tradepartner_profile",
                connectionMode: "express",
                profileId: target.profileId,
                businessId: target.businessId,
                requestType: body.requestType,
                stoneName: body.stoneName || null,
                contactCheck: "phone_required",
                membershipOnboarding: requesterWasCreated
                  ? "provisional_account_created"
                  : viewerId
                    ? "signed_in_account_attached"
                    : "existing_account_match_unverified",
              },
            },
            {
              workRequestId: request.id,
              type: "provider_invited",
              actorUserId: String(requester.id),
              metadata: {
                source: "tradepartner_profile",
                connectionMode: "express",
                businessId: target.businessId,
                responderUserId: target.ownerUserId,
              },
            },
          ]);
          return [request];
        });

        try {
          await notificationService.createNotification({
            userId: target.ownerUserId,
            type: "new_project_request",
            title: `New request for ${target.businessName}`,
            message: `${body.name} sent a request from the public profile.`,
            actionUrl: "/direct-connect/inbox",
            actionText: "Open request",
            iconName: "briefcase",
            iconColor: "orange",
            deliveryMethods: ["in_app", "push"],
          });
        } catch (error) {
          // The request is already committed. A notification outage must not
          // report a false submission failure and invite duplicate requests.
          console.warn("[tradepartner-express] owner notification failed", {
            requestId: created.id,
            ownerUserId: target.ownerUserId,
            error,
          });
        }

        try {
          await notifySuperAdminsOfDirectConnectRequest({
            requestId: String(created.id),
            requestTitle: title,
            businessName: target.businessName,
          });
        } catch (error) {
          console.warn("[tradepartner-express] beta admin notification failed", {
            requestId: created.id,
            error,
          });
        }

        let businessEmailStatus: "sent" | "skipped" | "failed" = "skipped";
        if (target.notificationEmail && emailService.isConfigured()) {
          const publicBase = String(
            process.env.APP_BASE_URL || "https://www.thetradescout.com"
          ).replace(/\/$/, "");
          const inboxUrl = `${publicBase}/direct-connect/inbox`;
          try {
            const emailResult = await emailService.sendEmail({
              to: target.notificationEmail,
              subject: `New request for ${target.businessName}`,
              html: [
                `<p>${escapeHtml(body.name)} sent a request through your ${escapeHtml(target.businessName)} profile on TradeScout.</p>`,
                body.stoneName
                  ? `<p><strong>Stone:</strong> ${escapeHtml(body.stoneName)}</p>`
                  : "",
                `<p><strong>Request type:</strong> ${escapeHtml(requestTitle(body.requestType, target.businessName))}</p>`,
                `<p>Contact details stay inside TradeScout until you respond -- open Direct Connect to view the full message and reply.</p>`,
                `<p><a href=\"${inboxUrl}\">Open Direct Connect inbox</a>.</p>`,
              ]
                .filter(Boolean)
                .join("\n"),
              text: [
                `${body.name} sent a request through your ${target.businessName} profile on TradeScout.`,
                body.stoneName ? `Stone: ${body.stoneName}` : null,
                `Request type: ${requestTitle(body.requestType, target.businessName)}`,
                `Open Direct Connect inbox: ${inboxUrl}`,
              ]
                .filter(Boolean)
                .join("\n"),
              purpose: "tradepartner_request_notification",
            });
            businessEmailStatus = emailResult.skipped ? "skipped" : "sent";
          } catch (error) {
            businessEmailStatus = "failed";
            console.warn("[tradepartner-express] business notification email failed", {
              requestId: created.id,
              notificationEmail: target.notificationEmail,
              error,
            });
          }
        }

        const requestWorkspacePath = `/direct-connect/engagements?requestId=${encodeURIComponent(String(created.id))}&offerHomeId=1&source=profile_express`;
        const activation = requesterWasCreated
          ? passwordResetService.createToken(String(requester.id))
          : null;
        const verification = requesterWasCreated
          ? emailVerificationService.createToken(String(requester.id))
          : null;
        const onboardingPath = activation
          ? `/reset-password?token=${encodeURIComponent(activation.token)}&next=${encodeURIComponent(requestWorkspacePath)}`
          : null;
        let onboardingEmailStatus: "sent" | "skipped" | "failed" = "skipped";

        if (emailService.isConfigured()) {
          const publicBase = String(
            process.env.APP_BASE_URL || "https://www.thetradescout.com"
          ).replace(/\/$/, "");
          const activationUrl = onboardingPath
            ? `${publicBase}${onboardingPath}`
            : `${publicBase}${requestWorkspacePath}`;
          const verificationUrl = verification
            ? `${publicBase}/verify-email?token=${verification.token}&next=${encodeURIComponent(requestWorkspacePath)}`
            : null;
          try {
            const emailResult = await emailService.sendEmail({
              to: requester.email,
              subject: `Your request was sent to ${target.businessName}`,
              html: [
                `<p>Your request was sent directly to ${escapeHtml(target.businessName)}.</p>`,
                requesterWasCreated
                  ? "<p>Your contact details also created your free TradeScout account so you can follow this request and Direct Connect with the business.</p>"
                  : "<p>This request is now attached to your TradeScout account.</p>",
                `<p><a href="${activationUrl}">${requesterWasCreated ? "Set up account access" : "Open My Requests"}</a>.</p>`,
                verificationUrl ? `<p><a href="${verificationUrl}">Verify your email</a>.</p>` : "",
              ].join("\n"),
              text: [
                `Your request was sent directly to ${target.businessName}.`,
                `Open My Requests: ${activationUrl}`,
                verificationUrl ? `Verify your email: ${verificationUrl}` : null,
              ]
                .filter(Boolean)
                .join("\n"),
              purpose: requesterWasCreated
                ? "account_creation"
                : "direct_connect_requester_confirmation",
            });
            onboardingEmailStatus = emailResult.skipped ? "skipped" : "sent";
          } catch (error) {
            onboardingEmailStatus = "failed";
            console.warn("[tradepartner-express] requester onboarding email failed", {
              requestId: created.id,
              requesterUserId: requester.id,
              error,
            });
          }
        }

        console.info("[tradepartner-express] phone-gated request created", {
          requestId: created.id,
          profileId: target.profileId,
          businessId: target.businessId,
          requesterUserId: requester.id,
          source: "tradepartner_profile",
          connectionMode: "express",
          accountCreated: requesterWasCreated,
        });
        return res.status(201).json({
          requestId: created.id,
          status: created.status,
          businessName: target.businessName,
          delivered: true,
          businessEmailStatus,
          accountCreated: requesterWasCreated,
          onboardingPath,
          onboardingEmailStatus,
          requestWorkspacePath,
          membershipNext: requesterWasCreated
            ? "Set up your TradeScout access to follow this request."
            : viewerId
              ? "Open My Requests to follow this request in Direct Connect."
              : "Sign in to follow this request in Direct Connect.",
        });
      } catch (error) {
        console.error("[tradepartner-express] request creation failed", error);
        return res.status(500).json({ message: "The request could not be sent." });
      }
    }
  );

  // Super-admin only: verify the business-notification email path (purpose,
  // EMAIL_MODE allow-list, provider) actually delivers without creating a
  // real work request against a live TradePartner's Direct Connect inbox.
  app.post(
    "/api/admin/tradepartner-express/test-notification-email",
    isAuthenticated,
    isSuperAdmin,
    async (req: OptionalAuthedRequest, res: Response) => {
      try {
        const to = String(req.body?.to || "").trim();
        if (!to) return res.status(400).json({ message: "Provide a 'to' email address." });
        if (!emailService.isConfigured()) {
          return res.status(503).json({ message: "Email provider is not configured." });
        }
        const result = await emailService.sendEmail({
          to,
          subject: "TradeScout test: business notification email",
          html: "<p>This is an admin-triggered test of the tradepartner_request_notification email path. If you received this, the EMAIL_MODE allow-list and provider config are working.</p>",
          text: "This is an admin-triggered test of the tradepartner_request_notification email path. If you received this, the EMAIL_MODE allow-list and provider config are working.",
          purpose: "tradepartner_request_notification",
        });
        return res.json({ sent: !result.skipped, messageId: result.messageId || null });
      } catch (error) {
        console.error("[tradepartner-express] test notification email failed", error);
        return res.status(500).json({ message: "Test email failed to send." });
      }
    }
  );
}
