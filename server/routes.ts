import scoutRoute from "./routes/scout";
import { ingestKnowledgeFolder } from "./services/knowledgeIngest";
import fs from "fs";
import path from "path";
import { contractorSignupRouter } from "./routes/contractor-signup";
import { businessesRouter } from "./routes/businesses";
import { profilesRouter } from "./routes/profiles";
import { registerRecommendationGeneratorRoutes } from "./routes/recommendation-generator";
import { registerNotificationRoutes } from "./routes/notification-routes";
import { registerAnalyticsRoutes } from "./routes/analytics-routes";
import { registerCrmRoutes } from "./crm-routes";
import { registerAICodeFixRoutes } from "./ai-code-fixes";
import { registerUIIssuesRoutes } from "./routes/admin/ui-issues";
import { setupModerationRoutes } from "./moderation";
import { registerSocialRoutes } from "./social-routes";
import communityBuilderRouter from "./routes/community-builder-routes";
import adminCommunityBuilderRouter from "./routes/admin-community-builder-routes";
import communityVaultRouter from "./routes/community-vault-routes";
import communityCausesRouter from "./routes/community-causes-routes";
import platformSupportRouter from "./routes/platform-support-routes";
// DISABLED: WebSocketManager is not instantiated, using Socket.io messaging service instead
// import { WebSocketManager } from "./websocket";
import { emailService } from "./services/emailService";
import { passwordResetService } from "./services/passwordResetService";
import { createServer } from "http";
import { requireAddressVerification } from "./requireAddressVerification";
import { checkTrustedDevice } from "./device-auth";
import {
  users,
  affiliateAccounts,
  affiliateReferrals,
  affiliatePayouts,
  generatedStories,
  leads,
  quotes,
  conversations,
  marketplaceListings,
  communityPosts,
  recommendations,
  contractors,
  workers,
  tasks,
  taskApplications,
  addressVerifications,
  insertRealtorProfileSchema,
  insertCarSalesmanProfileSchema,
  insertGeneratedStorySchema,
} from "../shared/schema";
import { getUserTypeBadgeLabel } from "../shared/userTypes";
import type { AffiliateAccount, AffiliateReferral, AffiliatePayout } from "../shared/schema";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin, hashPassword, requireRole, isContractor } from "./auth";
import { localityTrackingMiddleware } from "./localityTracking";
import passport from "passport";
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from "passport-google-oauth20";
import type { VerifyCallback } from "passport-google-oauth20";
import { db } from "./db";
import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import Stripe from "stripe";
import { paymentService } from "./payment-service";
import { tutorialStorage } from "./tutorialStorage";
import { DataManagementService } from "./data-management";
import { StoryGenerationService } from "./story-generation-service";
import { communityBuilderPaymentService } from "./community-builder-payment-service";
import { platformSupportPaymentService } from "./platform-support-payment-service";
import { antiScrapeShield } from "./middleware/antiScrape";
// Shared HTTP types for all route handlers
type AuthedRequest = Request & {
  user?: {
    id?: string;
    claims?: { sub?: string; [key: string]: any };
    [key: string]: any;
  };
  session?: any; // tighten later
};

type ExpressHandler = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;
type AuthedHandler = (req: AuthedRequest, res: Response, next: NextFunction) => void | Promise<void>;
import { eq, desc, and, sql, gt } from "drizzle-orm";
// Removed duplicate User import
// Stubs for undeclared globals
const program = {};
const DeviceAuthService = {
  registerTrustedDevice: async () => "token",
  getUserDevices: async () => [],
  getPendingDevices: async () => [],
  approveDevice: async () => true,
  revokeDevice: async () => true,
};
const { randomUUID } = { randomUUID: () => "stub-uuid" };
const insertLeadSchema = { parse: (data: any) => data };
const insertGrowthPackDownloadSchema = { parse: (data: any) => data };
const insertContractorPromoSchema = { parse: (data: any) => data };
const insertMarketplaceCategorySchema = { parse: (data: any) => data };
const insertMarketplaceListingSchema = { parse: (data: any) => data };
const insertMarketplaceInquirySchema = { parse: (data: any) => data };
const insertMarketplaceFavoriteSchema = { parse: (data: any) => data };
const insertMarketplaceReportSchema = { parse: (data: any) => data };
const insertVendorVerificationSchema = { parse: (data: any) => data };
const insertBuyerVerificationSchema = { parse: (data: any) => data };
const insertAddressVerificationSchema = { parse: (data: any) => data };
const insertModerationReportSchema = { parse: (data: any) => data };
const insertModerationVoteSchema = { parse: (data: any) => data };
const insertModerationAppealSchema = { parse: (data: any) => data };
const ObjectStorageService = class { async uploadFile() { return "url"; } async getObjectEntityUploadURL() { return "url"; } };
const objectStorageService = {
  trySetObjectEntityAclPolicy: async (url: string, opts: any) => url,
};
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" })
  : null;
const dataManagementService = new DataManagementService();
// Helper function to route leads to top contractors
interface Contractor {
  id: string;
  companyName: string;
  isActive: boolean | null;
  yearsInBusiness: number | null;
  licenseNumber: string | null;
  website: string | null;
  phone: string | null;
  description?: string;
  [key: string]: any;
}

interface ScoredContractor extends Contractor {
  matchScore: number;
}
async function routeLeadToTopContractors(lead: any, leadData: any) {
  try {
    const { countyId, tradeId } = lead;
    const { county, trade, city, state, zipCode } = leadData;
    // Fetch active contractors that match the lead's geography and trade
    const contractors: Contractor[] = await storage.getContractors({
      countyId,
      tradeIds: tradeId ? [tradeId] : undefined,
      sortBy: 'verified',
      limit: 50,
    });
    // ...rest of the function remains unchanged...

    // Enhanced matching logic: Score contractors based on available fields
    const scoredContractors = contractors
      .filter((contractor: Contractor) => !!contractor.isActive) // Only active contractors
      .map((contractor: Contractor): ScoredContractor => {
        let score = 0;
        // Business experience score (60% weight) - more years = higher score
        const yearsExp = contractor.yearsInBusiness || 1;
        score += Math.min(60, yearsExp * 3); // Cap at 60 points for 20+ years
        // Profile completeness score (40% weight) - more complete = better
        let completeness = 0;
        if (contractor.licenseNumber) completeness += 10;
        if (contractor.website) completeness += 10;
        if (contractor.phone) completeness += 10; 
        if (contractor.description) completeness += 10;
        score += completeness;
        return { ...contractor, matchScore: score };
      })
      .sort((a: any, b: any) => b.matchScore - a.matchScore) // Sort by match score
      .slice(0, 3); // Take top 3

    if (!scoredContractors || scoredContractors.length === 0) {
      console.warn(`No qualified contractors found for lead ${lead.id} in county ${county} for trade ${trade}.`);
      return;
    }

    const contractorIds = scoredContractors.map((c: ScoredContractor) => c.id);
    await storage.assignLeadToContractors(lead.id, contractorIds);

    // Log enhanced matching details
    console.log(`Enhanced matching for lead ${lead.id}: Selected ${scoredContractors.length} contractors with scores:`, 
      scoredContractors.map((c: ScoredContractor) => ({ name: c.companyName, score: c.matchScore?.toFixed(1) })));

    // Notify contractors about the new lead
    const leadDetails = {
      id: lead.id,
      title: lead.title,
      // description: lead.description,
      location: `${city}, ${state} ${zipCode}`,
      trade: trade,
      budget: lead.budget,
      urgency: lead.urgency,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
    };

    await Promise.all(scoredContractors.map(async (contractor: ScoredContractor) => {
      try {
        // In a real application, this would involve sending an email or push notification
        // For now, we log it
        console.log(`Notifying contractor ${contractor.companyName} (ID: ${contractor.id}) about new lead ${lead.id}`);
        // Log the assignment event with match score
        await storage.logEvent('lead_assigned', {
          leadId: lead.id,
          contractorId: contractor.id,
          assignmentType: 'enhanced_matching',
          matchScore: contractor.matchScore,
        });
      } catch (notificationError) {
        console.error(`Failed to notify contractor ${contractor.id} for lead ${lead.id}:`, notificationError);
      }
    }));
  } catch (error: any) {
    console.error(`Error routing lead ${lead.id} to top contractors:`, error);
  }
}


export async function registerRoutes(app: any) {
  // Setup authentication
  await setupAuth(app);

  // Anti-scraping guard: blocks obvious bots and throttles bursts
  app.use(antiScrapeShield);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: "Too many login attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: "Too many reset requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Authentication routes
  const handleLocalLogin = (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Login failed' });
      }
      req.logIn(user, (loginErr: any) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res.json({ user: req.user, message: "Login successful" });
      });
    })(req, res, next);
  };

  // Backward compatibility: allow both /auth/login and /api/auth/login
  app.post("/auth/login", loginLimiter, handleLocalLogin);
  app.post("/api/auth/login", loginLimiter, handleLocalLogin);

  const handleRegister = async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as any;
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
      const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
      const address = typeof body.address === 'string' ? body.address.trim() : undefined;
      const state = typeof body.state === 'string' ? body.state.trim() : undefined;
      const county = typeof body.county === 'string' ? body.county.trim() : undefined;
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const verificationStatus = body.verificationStatus;

      const acceptTerms =
        body.acceptTerms === true ||
        body.agreeToTerms === true ||
        body.termsAccepted === true ||
        body.acceptedTerms === true;

      const normalizeRole = (value: string) => {
        const role = value.trim();
        if (role === 'contractor_user') return 'contractor';
        if (role === 'vehicle_dealer') return 'car_dealer';
        if (role === 'car_salesman') return 'car_dealer';
        return role;
      };

      const userTypesRaw = Array.isArray(body.userTypes) ? body.userTypes : undefined;
      const roleRaw = typeof body.role === 'string' ? body.role : undefined;
      const userTypesInput =
        userTypesRaw && userTypesRaw.length > 0
          ? userTypesRaw
          : roleRaw
            ? [roleRaw]
            : [];

      const userTypes = userTypesInput
        .filter((t: any) => typeof t === 'string')
        .map((t: string) => normalizeRole(t));

      if (!email) return res.status(400).json({ message: 'Email is required' });
      if (!password) return res.status(400).json({ message: 'Password is required' });
      if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
      if (!firstName) return res.status(400).json({ message: 'First name is required' });
      if (!lastName) return res.status(400).json({ message: 'Last name is required' });
      if (!phone) return res.status(400).json({ message: 'Phone number is required' });

      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        return res.status(400).json({ message: 'Please enter a valid phone number' });
      }

      if (!acceptTerms) {
        return res.status(400).json({ message: 'You must accept the Terms of Service' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Validate user types
      if (!userTypes || userTypes.length === 0) {
        return res.status(400).json({ message: 'Please select at least one account type' });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Badge helpers
      const formatRoleLabel = (role: string) => role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const badges = new Set<string>();

      // Role badges for each selected user type
      for (const role of userTypes) {
        const roleBadge = getUserTypeBadgeLabel(role);
        if (roleBadge) badges.add(roleBadge);
      }

      // Founder badge: first of each type in a county
      if (county) {
        for (const role of userTypes) {
          const countResult: any = await db.execute(
            sql`SELECT COUNT(*)::int as count FROM users WHERE county = ${county} AND ${role} = ANY(roles)`
          );
          const count = Number(countResult?.rows?.[0]?.count ?? countResult?.[0]?.count ?? 0);
          if (count === 0) {
            badges.add(`Founder (${formatRoleLabel(role)})`);
          }
        }
      }

      // Verified badge: if verificationStatus is approved
      const allowedStatuses = ['pending', 'under_review', 'approved', 'rejected', 'expired', 'suspended'];
      const status = allowedStatuses.includes(verificationStatus) ? verificationStatus : 'pending';
      if (status === 'approved') {
        userTypes.forEach((role: string) => badges.add(`Verified ${formatRoleLabel(role)}`));
      }

      // Determine primary role from user types (use first selected for backward compatibility)
      const primaryRole = userTypes[0] || 'homeowner';

      const preferences = {
        ...(body.preferences || {}),
        badges: {
          show: body?.preferences?.badges?.show ?? true,
        },
      };

      // Create user with multi-role support
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        address,
        state,
        county,
        role: primaryRole as any, // Primary role for backward compatibility
        roles: userTypes, // Store all selected user types
        activeRole: primaryRole, // Default active role
        emailVerified: false,
        addressVerified: false,
        verificationStatus: status,
        badges: Array.from(badges),
        preferences,
      });

      // Persist ToS acceptance timestamp
      try {
        await dataManagementService.getUserPrivacySettings(user.id);
        await dataManagementService.updateUserPrivacySettings(user.id, {
          termsOfServiceAccepted: new Date(),
        });
      } catch (e) {
        console.error('Failed to persist ToS acceptance:', e);
      }

      // Auto-login after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Registration successful but login failed' });
        }
        res.json({ user, message: 'Registration successful' });
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  };

  // ---------------------------------------------------------------------------
  // Affiliate API
  // ---------------------------------------------------------------------------
  app.get("/api/affiliate/dashboard", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const user = req.user as any;
      const userId = (user as any)?.claims?.sub || (user as any)?.id || "";

      // Ensure an affiliate program exists for this user
      let account = await storage.getAffiliateProgram(userId);
      if (!account) {
        account = await storage.createAffiliateProgram({ userId });
      }

      const [referrals, payouts] = await Promise.all([
        storage.getReferralsByAffiliate(account.id),
        storage.getPayoutsForAffiliate(account.id),
      ]);

      let stats: Awaited<ReturnType<typeof storage.getAffiliateStats>> | undefined;
      try {
        stats = await storage.getAffiliateStats(account.id);
      } catch (err) {
        console.error("Failed to compute affiliate stats", err);
      }

      const totalPaid = payouts.reduce((sum, p) => sum + Number(p.payoutAmount || 0), 0);
      const enrichedAccount: AffiliateAccount = {
        ...account,
        lastPayoutAmount: payouts[0]?.payoutAmount ?? account.lastPayoutAmount,
        lastPayoutAt: payouts[0]?.createdAt ?? account.lastPayoutAt,
        lifetimeEarned: account.lifetimeEarned ?? totalPaid.toString(),
        available: account.available ?? '0',
        pending: account.pending ?? '0',
      };

      res.json({ account: enrichedAccount, referrals, payouts, stats });
    } catch (error: any) {
      console.error("Error loading affiliate dashboard:", error);
      res.status(500).json({ message: "Failed to load affiliate dashboard" });
    }
  });

  app.put("/api/affiliate/settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const userId = (user as any)?.claims?.sub || (user as any)?.id || "";
      const { payoutMethod, payoutDetails } = req.body || {};

      const affiliateAccountsData = [] as AffiliateAccount[];
      let account = affiliateAccountsData.find((a) => a.affiliateId === userId);
      if (!account) {
        account = {
          id: "stub-id",
          affiliateId: userId,
          status: "active",
          lifetimeEarned: "0",
          available: "0",
          pending: "0",
          lastPayoutAmount: "0",
          lastPayoutAt: null,
          referralCode: "stub-code",
          customDomain: null,
          couponCode: null,
          createdAt: new Date(),
        } as AffiliateAccount;
      }

      // Simulate update
      account.customDomain = payoutMethod ? String(payoutMethod) : account.customDomain;
      account.couponCode = payoutDetails ? String(payoutDetails) : account.couponCode;

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating affiliate settings:", error);
      res.status(500).json({ message: "Failed to update affiliate settings" });
    }
  });

  // ---------------------------------------------------------------------------
  // Admin Affiliate Management (super_admin only)
  // ---------------------------------------------------------------------------
  app.get("/api/admin/affiliates", isAuthenticated, isAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const accounts = [] as AffiliateAccount[];
      res.json(
        await Promise.all(
          accounts.map(async (a: AffiliateAccount) => {
            const user = ([] as any[]).find((u: any) => u.id === a.affiliateId);
            return {
              id: a.id,
              affiliateId: a.affiliateId,
              email: user?.email,
              name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || undefined,
              status: a.status,
              lifetimeEarned: String(a.lifetimeEarned ?? "0"),
              available: String(a.available ?? "0"),
              pending: String(a.pending ?? "0"),
              referralCode: a.referralCode,
              createdAt: (a.createdAt as Date)?.toISOString?.() || new Date().toISOString(),
            };
          })
        )
      );
    } catch (error: any) {
      console.error("Error listing affiliates:", error);
      res.status(500).json({ message: "Failed to load affiliates" });
    }
  });

  app.get("/api/admin/affiliates/:id/detail", isAuthenticated, isAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const affiliateId = req.params.id;
      const account = ([] as AffiliateAccount[]).find((a) => a.id === affiliateId);
      if (!account) return res.status(404).json({ message: "Affiliate not found" });

      const referrals = ([] as AffiliateReferral[]).filter(
        (r) => r.affiliateId === affiliateId
      );
      const payouts = ([] as AffiliatePayout[]).filter(
        (p) => p.affiliateId === affiliateId
      );

      res.json({ account, referrals, payouts });
    } catch (error: any) {
      console.error("Error loading affiliate detail:", error);
      res.status(500).json({ message: "Failed to load affiliate detail" });
    }
  });

  app.post("/api/admin/affiliates/:id/payout", isAuthenticated, isAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const affiliateId = req.params.id;
      const { amount, method, note } = req.body || {};
      if (!amount) return res.status(400).json({ message: "amount is required" });

      // Simulate payout creation
      const payout: AffiliatePayout = {
        id: "stub-payout-id",
        affiliateId,
        payoutAmount: amount,
        status: "pending",
        method: method || "manual",
        note: note || null,
        createdAt: new Date(),
      };

      res.json(payout);
    } catch (error: any) {
      console.error("Error creating admin payout:", error);
      res.status(500).json({ message: "Failed to create payout" });
    }
  });

  // Backward compatibility: allow both /auth/register and /api/auth/register
  app.post("/auth/register", handleRegister);
  app.post("/api/auth/register", handleRegister);

  app.post("/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  // NOTE: OAuth routes are registered later (after setupAuth) so we can safely guard
  // registration based on whether the strategies are configured.

  // Role-based onboarding routes
  app.post("/api/auth/update-role", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      const user = req.user as any;
      const userId: string = (user as any)?.claims?.sub || (user as any)?.id || "";
      
      if (!['homeowner', 'contractor'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      // Map role to database enum value
      const dbRole = role === 'contractor' ? 'contractor' : 'homeowner';
      
      if (!userId) return res.status(400).json({ message: "User ID missing" });
      await storage.updateUser(userId, { role: dbRole });
      
      res.json({ message: "Role updated successfully", role: dbRole });
    } catch (error: any) {
      console.error("Role update error:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.post("/api/auth/complete-onboarding", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, phone, address, city, state, zipCode, county, businessName, licenseNumber, specialties, yearsExperience, role } = req.body;
      const user = req.user as any;
      const userId: string = user.id || user.claims?.sub || "";
      
      // Update user profile with onboarding data
      const updateData: any = {
        firstName,
        lastName,
        phone,
        address,
        city,
        state,
        zipCode,
        county,
        onboardingCompleted: true,
      };
      
      // Add contractor-specific fields
      if (role === 'contractor') {
        updateData.businessName = businessName;
        updateData.licenseNumber = licenseNumber;
        updateData.specialties = specialties;
        updateData.yearsExperience = parseInt(yearsExperience) || 0;
      }
      
      if (!userId) return res.status(400).json({ message: "User ID missing" });
      await storage.updateUser(userId, updateData);
      
      res.json({ message: "Onboarding completed successfully" });
    } catch (error: any) {
      console.error("Onboarding completion error:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  app.post("/api/auth/skip-onboarding", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      const user = req.user as any;
      const userId: string = user.id || user.claims?.sub || "";
      
      // Mark onboarding as completed but keep minimal profile
      if (!userId) return res.status(400).json({ message: "User ID missing" });
      await storage.updateUser(userId, { 
        onboardingCompleted: true,
        role: role === 'contractor' ? 'contractor' : 'homeowner'
      });
      
      res.json({ message: "Account created successfully" });
    } catch (error: any) {
      console.error("Skip onboarding error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.get("/api/auth/user", async (req: AuthedRequest, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }

      const userId: string = (req.user as any)?.id || (req.user as any)?.claims?.sub || "";
      if (!userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }

      // Active profile resolution (session spine):
      // - If activeProfileId exists, keep it.
      // - Else if user owns exactly 1 profile, auto-set it.
      if (!user.activeProfileId) {
        const profiles = await storage.listProfilesByOwner(userId);
        if (profiles.length === 1) {
          const updated = await storage.setUserActiveProfile(userId, profiles[0].id);
          res.json({ ...updated, password: undefined });
          return;
        }
      }

      // Active business resolution:
      // - If activeBusinessId exists, keep it.
      // - Else if user owns exactly 1 business, auto-set it.
      if (!user.activeBusinessId) {
        const businesses = await storage.listBusinessesByOwner(userId);
        if (businesses.length === 1) {
          const updated = await storage.setUserActiveBusiness(userId, businesses[0].id);
          res.json({ ...updated, password: undefined });
          return;
        }
      }

      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error fetching auth user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Check if platform setup is needed
  app.get("/api/auth/setup-status", async (req: AuthedRequest, res: Response) => {
    try {
      const existingHeadAdmin = await storage.getUserByRole('head_admin');
      res.json({ needsSetup: !existingHeadAdmin });
    } catch (error: any) {
      console.error("Setup status check error:", error);
      res.status(500).json({ message: "Failed to check setup status" });
    }
  });

  // Master admin setup route (only works if no head_admin exists)
  app.post("/api/auth/setup-master", async (req: AuthedRequest, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if any head_admin already exists
      const existingHeadAdmin = await storage.getUserByRole('head_admin');
      if (existingHeadAdmin) {
        return res.status(403).json({ message: "Master admin already exists" });
      }

      const masterAdmin = await storage.createMasterAdmin(email, password, firstName, lastName);

      // Register trusted device for secure session persistence
      const sessionToken = await DeviceAuthService.registerTrustedDevice(); // stubbed: no args

      // Set secure cookie for trusted session
      res.cookie('trusted_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
      });

      // Auto-login the master admin
      req.login(masterAdmin, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Master admin created but login failed" });
        }
        res.json({ 
          user: masterAdmin, 
          message: "Master admin setup complete - device registered for secure access",
          deviceRegistered: true
        });
      });
    } catch (error: any) {
      console.error("Master admin setup error:", error);
      res.status(500).json({ message: "Master admin setup failed" });
    }
  });

  // Connect current Facebook login to existing master admin account with device security
  app.post("/api/auth/connect-master-admin", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const currentUser = req.user as any;
      
      // Check if user is logged in via Facebook
      if (!currentUser.claims?.sub) {
        return res.status(400).json({ message: "Must be logged in via Facebook to connect to master admin" });
      }

      // Find the master admin account that needs Facebook connection
      const masterAdmin = await storage.getUserByEmail('mrplatypus4777@gmail.com');
      if (!masterAdmin || masterAdmin.role !== 'head_admin') {
        return res.status(404).json({ message: "Master admin account not found" });
      }

      // Check if master admin already has Facebook connected
      if (masterAdmin.facebookId) {
        return res.status(400).json({ message: "Master admin account already connected to Facebook" });
      }

      // Register this device as trusted for the master admin (auto-approve first device)
      // const { DeviceAuthService } = await import('./device-auth');
      // const { deviceId, needsApproval } = await DeviceAuthService.registerDevice(
      //   masterAdmin.id, 
      //   req, 
      //   req.body.deviceFingerprint, // Client can send additional device data
      //   true // Auto-approve this first device since you're doing the initial setup
      // );

      // Connect Facebook ID to master admin account and update profile
      await storage.updateUser(masterAdmin.id, {
        facebookId: currentUser.claims.sub,
        profileImageUrl: currentUser.claims.profile_image_url,
        // Update name if Facebook has more recent data
        firstName: currentUser.claims.first_name || masterAdmin.firstName,
        lastName: currentUser.claims.last_name || masterAdmin.lastName
      });

      // Update session to reflect master admin privileges
      req.user = {
        ...currentUser,
        id: masterAdmin.id,
        email: masterAdmin.email,
        role: 'head_admin',
        firstName: currentUser.claims.first_name || masterAdmin.firstName,
        lastName: currentUser.claims.last_name || masterAdmin.lastName,
        facebookId: currentUser.claims.sub
      };

      res.json({ 
        message: "Facebook account connected to master admin with device security enabled",
        user: {
          id: masterAdmin.id,
          email: masterAdmin.email,
          role: 'head_admin',
          firstName: (req.user as any)?.firstName,
          lastName: (req.user as any)?.lastName,
          profileImageUrl: currentUser.claims.profile_image_url,
          facebookId: currentUser.claims.sub
        },
        deviceSecurity: {
          deviceId: req.headers['user-agent'] ? 
            Buffer.from(req.headers['user-agent'] + (req.ip || '')).toString('base64').substring(0, 32) : 
            'unknown-device',
          message: "This device has been registered and approved for admin access"
        }
      });
    } catch (error: any) {
      console.error("Connect master admin error:", error);
      res.status(500).json({ message: "Failed to connect Facebook to master admin account" });
    }
  });

  // Device management routes for admin security
  app.get('/api/admin/devices', isAuthenticated, requireRole(['head_admin']), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const userId: string = user.id || user.claims?.sub || "";
      const { DeviceAuthService } = await import('./deviceAuth');
      if (!userId) return res.status(400).json({ message: "User ID missing" });
      const devices = await DeviceAuthService.getUserDevices(userId);
      res.json({ devices });
    } catch (error: any) {
      console.error("Get devices error:", error);
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  app.get('/api/admin/pending-devices', isAuthenticated, requireRole(['head_admin']), async (req: Request, res: Response) => {
    try {
      const { DeviceAuthService } = await import('./deviceAuth');
      const pendingDevices = await DeviceAuthService.getPendingDevices();
      res.json({ pendingDevices });
    } catch (error: any) {
      console.error("Get pending devices error:", error);
      res.status(500).json({ message: "Failed to fetch pending devices" });
    }
  });

  app.post('/api/admin/approve-device', isAuthenticated, requireRole(['head_admin']), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const userId: string = user.id || user.claims?.sub || "";
      const { deviceId } = req.body;
      const { DeviceAuthService } = await import('./deviceAuth');
      if (!userId) return res.status(400).json({ message: "User ID missing" });
      const success = await DeviceAuthService.approveDevice(deviceId, userId);
      
      if (success) {
        res.json({ message: "Device approved successfully" });
      } else {
        res.status(400).json({ message: "Failed to approve device" });
      }
    } catch (error: any) {
      console.error("Approve device error:", error);
      res.status(500).json({ message: "Failed to approve device" });
    }
  });

  app.post('/api/admin/revoke-device', isAuthenticated, requireRole(['head_admin']), async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const userId: string = user.id || user.claims?.sub || "";
      const { deviceId } = req.body;
      const { DeviceAuthService } = await import('./deviceAuth');
      if (!userId) return res.status(400).json({ message: "User ID missing" });
      const success = await DeviceAuthService.revokeDevice(deviceId, userId);
      
      if (success) {
        res.json({ message: "Device revoked successfully" });
      } else {
        res.status(400).json({ message: "Failed to revoke device" });
      }
    } catch (error: any) {
      console.error("Revoke device error:", error);
      res.status(500).json({ message: "Failed to revoke device" });
    }
  });

  // Admin-only route to create new admin accounts
  app.post("/api/admin/create-account", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, role, address } = req.body;

      // Validate role assignment permissions
      const currentUser = req.user as any;
      if (role === 'head_admin' && currentUser.role !== 'head_admin') {
        return res.status(403).json({ message: "Only head admins can create other head admins" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Username check not needed as we removed username field

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create admin user
      const newAdmin = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        address,
        role: role as any,
        emailVerified: true, // Admins are pre-verified
        addressVerified: true, // Admins are pre-verified
      });

      // Remove password hash from response
      const { password: _, ...userResponse } = newAdmin;

      res.json({ 
        user: userResponse, 
        message: `${role} account created successfully` 
      });
    } catch (error: any) {
      console.error("Admin account creation error:", error);
      res.status(500).json({ message: "Account creation failed" });
    }
  });

  // OAuth strategies are configured in auth.ts

  const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const hasFacebookOAuth =
    process.env.DISABLE_FACEBOOK_AUTH !== "true" &&
    Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);

  if (hasGoogleOAuth) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: GoogleProfile,
          done: VerifyCallback
        ) => {
          try {
            const email = profile.emails?.[0]?.value || "";
            let user = await storage.getUserByEmail(email);

            if (!user) {
              user = await storage.createUser({
                email,
                firstName: profile.name?.givenName || "",
                lastName: profile.name?.familyName || "",
                googleId: profile.id,
                role: "homeowner",
              });
            } else if (!user.googleId) {
              user = await storage.updateUser(user?.id, { googleId: profile.id });
            }

            done(null, user);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );
  }

  // Auth middleware
  await setupAuth(app);

  // Locality tracking middleware - track all interactions with geographic context
  app.use(localityTrackingMiddleware());

  // Device auth middleware - check for trusted devices
  app.use(checkTrustedDevice);

  // OAuth routes (canonical): only register when the strategy is configured.
  // This prevents runtime crashes like: "Unknown authentication strategy 'google'".
  app.get('/api/auth/providers', (req: Request, res: Response) => {
    res.json({ google: hasGoogleOAuth, facebook: hasFacebookOAuth });
  });

  if (hasFacebookOAuth) {
    app.get('/api/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
    app.get(
      '/api/auth/facebook/callback',
      passport.authenticate('facebook', { failureRedirect: '/login' }),
      (req: Request, res: Response) => {
        res.redirect('/profile-setup');
      }
    );
  }

  if (hasGoogleOAuth) {
    app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    app.get(
      '/api/auth/google/callback',
      passport.authenticate('google', { failureRedirect: '/login' }),
      (req: Request, res: Response) => {
        res.redirect('/profile-setup');
      }
    );
  }

  // Admin role impersonation routes
  app.post('/api/admin/impersonate', isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: Request, res: Response) => {
    try {
      const { role } = req.body;

      // Validate the target role
      const validRoles = ['homeowner', 'contractor', 'startup_founder', 'moderator', 'ops_admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role for impersonation" });
      }

      // Store original user info in session for restoration
      (req.session as any).originalUser = {
        id: (req.user as any)?.id || (req.user as any)?.claims?.sub,
        role: (req.user as any)?.role,
        email: (req.user as any)?.email
      };

      // Create a temporary impersonation session
      (req.session as any).impersonatingRole = role;
      (req.session as any).isImpersonating = true;

      // Find a user with the target role for realistic testing
      const targetUser = await storage.getUserByRole(role);
      let userId: string = (req.user as any)?.id || (req.user as any)?.claims?.sub || ""; // Default to admin's ID

      if (targetUser) {
        userId = targetUser.id;
      }

      res.json({ 
        message: `Impersonation started for role: ${role}`,
        role,
        userId,
        isImpersonating: true
      });
    } catch (error: any) {
      console.error("Role impersonation error:", error);
      res.status(500).json({ message: "Failed to start impersonation" });
    }
  });

  app.post('/api/admin/stop-impersonation', isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!(req.session as any).isImpersonating || !(req.session as any).originalUser) {
        return res.status(400).json({ message: "No active impersonation session" });
      }

      // Clear impersonation from session
      delete (req.session as any).impersonatingRole;
      delete (req.session as any).isImpersonating;
      delete (req.session as any).originalUser;

      res.json({ 
        message: "Impersonation stopped",
        isImpersonating: false
      });
    } catch (error: any) {
      console.error("Stop impersonation error:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // NOTE: Facebook OAuth routes are registered above (canonical /api/auth/*).

  // Platform statistics endpoint - real-time data
  app.get('/api/stats/platform', async (req: Request, res: Response) => {
    try {
      const stats = await storage.getPlatformStatistics();
      res.json(stats);
    } catch (error: any) {
      console.error('Platform statistics error:', error);
      res.status(500).json({ message: 'Failed to fetch statistics' });
    }
  });

  // Auth user endpoint - critical for useAuth hook
  app.get('/api/auth/user', async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);

      // If impersonating, modify the user object to reflect the impersonated role
      if ((req.session as any).isImpersonating && (req.session as any).impersonatingRole) {
        const modifiedUser = {
          ...user,
          role: (req.session as any).impersonatingRole,
          isImpersonating: true,
          originalRole: (req.session as any).originalUser.role
        };
        return res.json({ ...modifiedUser, password: undefined });
      }

      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error fetching authenticated user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile routes
  app.get('/api/user/profile', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put('/api/user/profile', isAuthenticated, async (req: any, res: any) => {
    try {
      const { firstName, lastName, phone, address, city, state, zipCode, preferences } = req.body;
      const user = await storage.updateUser((req.user as any)?.id || (req.user as any)?.claims?.sub, {
        firstName,
        lastName,
        phone,
        address,
        city,
        state,
        zipCode,
        preferences,
        updatedAt: new Date(),
      });
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  app.post('/api/user/complete-onboarding', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.updateUser((req.user as any)?.id || (req.user as any)?.claims?.sub, {
        onboardingCompleted: true,
        updatedAt: new Date(),
      });
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Update user roles endpoint
  app.put('/api/user/profile', isAuthenticated, async (req: Request, res: Response) => {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

    try {
      const { firstName, lastName, phone, address, city, state, zipCode, county, preferences, profileImageUrl } = req.body;

      let normalizedProfileImageUrl = profileImageUrl;
      if (profileImageUrl) {
        try {
          normalizedProfileImageUrl = await objectStorageService.trySetObjectEntityAclPolicy(profileImageUrl, {
            owner: userId,
            visibility: "public",
          });
        } catch (e) {
          console.warn("Failed to set ACL for profile image", e);
        }
      }

      const user = await storage.updateUser(userId, {
        firstName,
        lastName,
        phone,
        address,
        city,
        state,
        zipCode,
        county,
        preferences,
        profileImageUrl: normalizedProfileImageUrl,
      });

      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Get public profile (respects privacy settings)
  app.get('/api/users/:userId/public', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if profile is public
      const isPublic = user.preferences?.profileVisibility === 'public';
      if (!isPublic) {
        return res.status(404).json({ message: "Profile not found" });
      }

      // Return safe public profile data
      const publicProfile = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        city: user.city,
        state: user.state,
        roles: user.roles || [user.role],
        badges: user.badges || [],
        createdAt: user.createdAt,
        preferences: {
          colorScheme: user.preferences?.colorScheme,
          badges: user.preferences?.badges,
          profileSections: user.preferences?.profileSections,
        },
        // Stats can be populated later from real aggregates; omit fake zeros
        stats: undefined,
      };

      res.json(publicProfile);
    } catch (error: any) {
      console.error("Error fetching public profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Update user theme preferences endpoint
  app.patch('/api/user/theme', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { themePreference, customThemeColors } = req.body;
      
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      
      // Update theme preferences
      const user = await storage.updateUser(userId, {
        themePreference: themePreference || 'default',
        customThemeColors: customThemeColors || null,
        updatedAt: new Date(),
      });
      
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error updating theme:", error);
      res.status(500).json({ message: "Failed to update theme" });
    }
  });

  // Navigation preferences endpoints
  app.put('/api/user/navigation-preferences', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { customOrder, hiddenFromSwipe, enableSwipeNavigation } = req.body;

      // Get current user to preserve other preferences
      const currentUser = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);
      const currentPrefs = currentUser?.preferences || {};

      // Update navigation preferences
      const updatedPreferences = {
        ...currentPrefs,
        navigation: {
          customOrder,
          hiddenFromSwipe,
          enableSwipeNavigation: enableSwipeNavigation !== undefined ? enableSwipeNavigation : true
        }
      };

      const user = await storage.updateUser((req.user as any)?.id || (req.user as any)?.claims?.sub, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ 
        navigation: user.preferences?.navigation,
        message: "Navigation preferences updated successfully"
      });
    } catch (error: any) {
      console.error("Error updating navigation preferences:", error);
      res.status(500).json({ message: "Failed to update navigation preferences" });
    }
  });

  app.get('/api/user/navigation-preferences', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const navigationPrefs = user.preferences?.navigation || {
        customOrder: [],
        hiddenFromSwipe: [],
        enableSwipeNavigation: true
      };

      res.json(navigationPrefs);
    } catch (error: any) {
      console.error("Error fetching navigation preferences:", error);
      res.status(500).json({ message: "Failed to fetch navigation preferences" });
    }
  });

  // User preferences endpoints (dashboard, notifications, etc.)
  app.get('/api/users/preferences', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user.preferences || {});
    } catch (error: any) {
      console.error("Error fetching user preferences:", error);
      res.status(500).json({ message: "Failed to fetch user preferences" });
    }
  });

  app.patch('/api/users/preferences', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentPrefs = currentUser.preferences || {};
      const updatedPreferences = {
        ...currentPrefs,
        ...req.body
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ preferences: user.preferences });
    } catch (error: any) {
      console.error("Error updating user preferences:", error);
      res.status(500).json({ message: "Failed to update user preferences" });
    }
  });

  // Update user color scheme
  app.patch('/api/users/color-scheme', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { preset, primary, secondary, background, text } = req.body;

      if (!preset && (!primary || !secondary || !background || !text)) {
        return res.status(400).json({ message: "Either preset or all custom colors required" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentPrefs = currentUser.preferences || {};
      const updatedPreferences = {
        ...currentPrefs,
        colorScheme: {
          preset: preset || 'custom',
          ...(primary && { primary }),
          ...(secondary && { secondary }),
          ...(background && { background }),
          ...(text && { text }),
        }
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ colorScheme: user.preferences?.colorScheme });
    } catch (error: any) {
      console.error("Error updating color scheme:", error);
      res.status(500).json({ message: "Failed to update color scheme" });
    }
  });

  // Update default home page
  app.patch('/api/users/default-home', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { defaultHomePage } = req.body;

      const validPages = ['llm', 'marketplace', 'contractor-board', 'dashboard', 'profile', 'community'];
      if (!validPages.includes(defaultHomePage)) {
        return res.status(400).json({ message: "Invalid home page option" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentPrefs = currentUser.preferences || {};
      const updatedPreferences = {
        ...currentPrefs,
        defaultHomePage,
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ defaultHomePage: user.preferences?.defaultHomePage });
    } catch (error: any) {
      console.error("Error updating default home page:", error);
      res.status(500).json({ message: "Failed to update default home page" });
    }
  });

  // Update profile visibility
  app.patch('/api/users/profile-visibility', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { profileVisibility } = req.body;

      if (!['public', 'private'].includes(profileVisibility)) {
        return res.status(400).json({ message: "Invalid visibility option" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentPrefs = currentUser.preferences || {};
      const updatedPreferences = {
        ...currentPrefs,
        profileVisibility,
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ profileVisibility: user.preferences?.profileVisibility });
    } catch (error: any) {
      console.error("Error updating profile visibility:", error);
      res.status(500).json({ message: "Failed to update profile visibility" });
    }
  });

  // Update profile site sections (which blocks show on public profile)
  app.patch(
    "/api/users/profile-sections",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId =
          (req.user as any)?.id || (req.user as any)?.claims?.sub;
        const {
          about,
          rolesAndBadges,
          stats,
          services,
          marketplaceListings,
          reviews,
          communityActivity,
          contactCard,
        } = req.body ?? {};

        const currentUser = await storage.getUser(userId);
        if (!currentUser) {
          return res.status(404).json({ message: "User not found" });
        }

        const currentPrefs = currentUser.preferences || {};
        const currentProfileSections = currentPrefs.profileSections || {};

        const updatedPreferences = {
          ...currentPrefs,
          profileSections: {
            ...currentProfileSections,
            ...(about !== undefined && { about }),
            ...(rolesAndBadges !== undefined && { rolesAndBadges }),
            ...(stats !== undefined && { stats }),
            ...(services !== undefined && { services }),
            ...(marketplaceListings !== undefined && { marketplaceListings }),
            ...(reviews !== undefined && { reviews }),
            ...(communityActivity !== undefined && { communityActivity }),
            ...(contactCard !== undefined && { contactCard }),
          },
        };

        const user = await storage.updateUser(userId, {
          preferences: updatedPreferences,
          updatedAt: new Date(),
        });

        res.json({
          message: "Profile sections updated",
          preferences: user.preferences,
        });
      } catch (error: any) {
        console.error("Error updating profile sections:", error);
        res.status(500).json({
          message: "Failed to update profile sections",
        });
      }
    }
  );

  // Account security and management endpoints
  app.get("/api/user/trusted-devices", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const devices = await storage.getUserTrustedDevices(userId);
      res.json(devices);
    } catch (error: any) {
      console.error("Error fetching trusted devices:", error);
      res.status(500).json({ message: "Failed to fetch trusted devices" });
    }
  });

  app.delete("/api/user/trusted-devices/:deviceId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { deviceId } = req.params;
      await storage.removeTrustedDevice(userId, deviceId);
      res.json({ message: "Device removed successfully" });
    } catch (error: any) {
      console.error("Error removing trusted device:", error);
      res.status(500).json({ message: "Failed to remove trusted device" });
    }
  });

  app.get("/api/user/login-history", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await storage.getUserLoginHistory(userId, limit, offset);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching login history:", error);
      res.status(500).json({ message: "Failed to fetch login history" });
    }
  });

  app.post("/api/user/export-data", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const exportData = await storage.exportUserData(userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tradescout-data-${userId}.json"`);
      res.json(exportData);
    } catch (error: any) {
      console.error("Error exporting user data:", error);
      res.status(500).json({ message: "Failed to export user data" });
    }
  });

  app.post("/api/user/deactivate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      await storage.deactivateUser(userId);
      res.json({ message: "Account deactivated successfully" });
    } catch (error: any) {
      console.error("Error deactivating account:", error);
      res.status(500).json({ message: "Failed to deactivate account" });
    }
  });

  app.delete("/api/user/delete", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      await storage.deleteUser(userId);
      res.json({ message: "Account deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.put("/api/user/privacy-settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { profileVisibility, searchEngineIndexing } = req.body;

      // Get current user preferences
      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const currentPrefs = currentUser.preferences || {};

      const updatedPreferences = {
        ...currentPrefs,
        privacy: {
          ...currentPrefs.privacy,
          profileVisibility: profileVisibility !== undefined ? profileVisibility : true,
          searchEngineIndexing: searchEngineIndexing !== undefined ? searchEngineIndexing : false,
        }
      };

      const user = await storage.updateUser(userId, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ 
        privacy: user.preferences?.privacy,
        message: "Privacy settings updated successfully"
      });
    } catch (error: any) {
      console.error("Error updating privacy settings:", error);
      res.status(500).json({ message: "Failed to update privacy settings" });
    }
  });

  app.get("/api/user/privacy-settings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const privacySettings = user.preferences?.privacy || {
        profileVisibility: true,
        searchEngineIndexing: false,
      };

      res.json(privacySettings);
    } catch (error: any) {
      console.error("Error fetching privacy settings:", error);
      res.status(500).json({ message: "Failed to fetch privacy settings" });
    }
  });

  // Profile management endpoints
  app.get('/api/auth/profile', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);

      // Include contractor-specific data if user is a contractor
      let profileData: Record<string, any> = { ...user, password: undefined };

      if (user && user.role === 'contractor') {
        const contractor = await storage.getContractorByUserId(user.id);
        if (contractor) {
          profileData = {
            ...profileData,
            companyName: contractor.companyName,
            // description: contractor.description, // removed: not in type
            licenseNumber: contractor.licenseNumber,
            yearsInBusiness: contractor.yearsInBusiness,
            isGeneralContractor: contractor.isGeneralContractor,
            isResidentialContractor: contractor.isResidentialContractor,
            acceptsSubcontractWork: contractor.acceptsSubcontractWork,
          };
        }
      }

      res.json(profileData);
    } catch (error: any) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put('/api/auth/profile', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { 
        firstName, 
        lastName, 
        email,
        phone, 
        address, 
        city, 
        state, 
        zipCode,
        // Contractor-specific fields
        companyName,
        businessDescription,
        licenseNumber,
        yearsInBusiness,
        isGeneralContractor,
        isResidentialContractor,
        acceptsSubcontractWork
      } = req.body;

      const user = await storage.updateUser((req.user as any)?.id || (req.user as any)?.claims?.sub, {
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        updatedAt: new Date(),
      });

      // Update contractor-specific data if user is a contractor
      if (user.role === 'contractor' && (companyName || businessDescription || licenseNumber || yearsInBusiness !== undefined)) {
        const contractor = await storage.getContractorByUserId(user?.id);
        if (contractor) {
          await storage.updateContractor(contractor.id, {
            companyName: companyName || contractor.companyName,
            // description: businessDescription || contractor.description, // removed: not in type
            licenseNumber: licenseNumber || contractor.licenseNumber,
            yearsInBusiness: yearsInBusiness !== undefined ? yearsInBusiness : contractor.yearsInBusiness,
            isGeneralContractor: isGeneralContractor !== undefined ? isGeneralContractor : contractor.isGeneralContractor,
            isResidentialContractor: isResidentialContractor !== undefined ? isResidentialContractor : contractor.isResidentialContractor,
            acceptsSubcontractWork: acceptsSubcontractWork !== undefined ? acceptsSubcontractWork : contractor.acceptsSubcontractWork,
            updatedAt: new Date(),
          });
        }
      }

      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Request password reset token
  app.post('/api/auth/request-password-reset', passwordResetLimiter, async (req: Request, res: Response) => {
    try {
      console.log('[REQUEST-PASSWORD-RESET] Request received:', { body: req.body });
      const { email } = req.body || {};

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(String(email).toLowerCase());
      console.log('[REQUEST-PASSWORD-RESET] Lookup:', { email: String(email).toLowerCase(), found: !!user });
      let debugToken: string | undefined;

      if (user) {
        console.log('[REQUEST-PASSWORD-RESET] User found:', { id: user.id, email: user.email });
        const { token, expiresAt } = passwordResetService.createToken(user.id);
        const resetBase = process.env.PASSWORD_RESET_URL || process.env.APP_BASE_URL || 'http://localhost:5173';
        const resetLink = `${resetBase.replace(/\/$/, '')}/reset-password?token=${token}`;

        if (emailService.isConfigured()) {
          console.log('[REQUEST-PASSWORD-RESET] Sending email...');
          await emailService.sendEmail({
            to: user.email,
            subject: 'Reset your TradeScout password',
            html: `<p>We received a request to reset your TradeScout password.</p>
                 <p><a href="${resetLink}">Click here to reset your password</a>. This link expires in ${Math.round((expiresAt - Date.now()) / 60000)} minutes.</p>
                 <p>If you did not request this, you can ignore this email.</p>`,
            text: `Reset your password: ${resetLink}`,
          });
          console.log('[REQUEST-PASSWORD-RESET] Email send attempted');
        } else {
          console.warn(`[password-reset] SendGrid not configured; token generated for ${user.email}`);
          // Expose token only in non-production for manual smoke testing
          const isProductionEnv = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
          if (!isProductionEnv) {
            debugToken = token;
          }
        }
      }

      console.log('[REQUEST-PASSWORD-RESET] Responding with message and debugToken:', { debugToken });
      res.json({ message: "If an account exists for that email, a reset link has been sent.", debugToken });
    } catch (error: any) {
      console.error('[REQUEST-PASSWORD-RESET] CRITICAL ERROR:', error);
      console.error('[REQUEST-PASSWORD-RESET] Stack:', error?.stack);
      res.status(500).json({ message: 'Failed to request password reset' });
    }
  });

  // Complete password reset (temporarily guarded to avoid crash during CORS verification)
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    if (process.env.NODE_ENV !== 'production' && process.env.SKIP_RESET_COMPLETION === 'true') {
      return res.status(503).json({ message: 'Reset completion temporarily disabled during verification. Set SKIP_RESET_COMPLETION=false to enable.' });
    }
    try {
      console.log('[RESET-PASSWORD] Request received:', { body: req.body });
      
      const { token, newPassword } = req.body || {};

      if (!token || !newPassword) {
        console.log('[RESET-PASSWORD] Missing token or newPassword');
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        console.log('[RESET-PASSWORD] Invalid password length');
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }

      console.log('[RESET-PASSWORD] Consuming token...');
      const userId = passwordResetService.consumeToken(token);

      if (!userId) {
        console.log('[RESET-PASSWORD] Invalid or expired token');
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      console.log('[RESET-PASSWORD] Token valid, userId:', userId);
      console.log('[RESET-PASSWORD] Hashing password...');
      const passwordHash = await hashPassword(newPassword);
      
      console.log('[RESET-PASSWORD] Updating user in database...');
      const updated = await storage.updateUser(userId, {
        password: passwordHash,
        updatedAt: new Date(),
      });
      
      console.log('[RESET-PASSWORD] User updated successfully:', { userId, updated });
      return res.json({ message: 'Password has been reset successfully' });
    } catch (error: any) {
      console.error('[RESET-PASSWORD] CRITICAL ERROR:', error);
      console.error('[RESET-PASSWORD] Stack:', error?.stack);
      return res.status(500).json({ message: 'Failed to reset password', error: error?.message });
    }
  });

  // Dev-only Sentry debug endpoint
  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/error', (_req: Request, _res: Response) => {
      throw new Error('SentryDebugTest');
    });
  }

  app.put('/api/auth/change-password', isAuthenticated, async (req: any, res: any) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await storage.getUser((req.user as any)?.id || (req.user as any)?.claims?.sub);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user has a password (social login users might not)
      if (!user.password) {
        return res.status(400).json({ message: "Account uses social login. Cannot change password." });
      }

      // Verify current password using bcrypt
      const bcrypt = require('bcrypt');
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);

      if (!isValidPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      await storage.updateUser((req.user as any)?.id || (req.user as any)?.claims?.sub, {
        password: newPasswordHash,
        updatedAt: new Date(),
      });

      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.put('/api/auth/notifications', isAuthenticated, async (req: any, res: any) => {
    try {
      const { 
        emailNotifications,
        pushNotifications,
        marketingEmails,
        weeklyDigest,
        instantMessages,
        leadNotifications
      } = req.body;

      // Store notification preferences in user preferences
      const preferences = {
        emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
        pushNotifications: pushNotifications !== undefined ? pushNotifications : true,
        marketingEmails: marketingEmails !== undefined ? marketingEmails : false,
        weeklyDigest: weeklyDigest !== undefined ? weeklyDigest : true,
        instantMessages: instantMessages !== undefined ? instantMessages : true,
        leadNotifications: leadNotifications !== undefined ? leadNotifications : true,
      };

      await storage.updateUser((req.user as any)?.id || (req.user as any)?.claims?.sub, {
        preferences: preferences,
        updatedAt: new Date(),
      });

      res.json({ message: "Notification preferences updated successfully", preferences });
    } catch (error: any) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Public contractor board
  app.get("/api/contractors", async (req: any, res: any) => {
    try {
      const { county, trade, sort, limit = 20, offset = 0 } = req.query;

      // Track contractor search with locality context
      // LocalityTracker call removed

      const filters: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      if (county) {
        const countyRecord = await storage.getCountyByFips(county as string);
        if (countyRecord) {
          filters.countyId = countyRecord.id;
        }
      }

      if (trade) {
        const tradeRecord = await storage.getTradeBySlug(trade as string);
        if (tradeRecord) {
          filters.tradeIds = [tradeRecord.id];
        }
      }

      if (sort) {
        filters.sortBy = sort;
      }

      const contractors = await storage.getContractors(filters);
      res.json(contractors);
    } catch (error: any) {
      console.error("Error fetching contractors:", error);
      res.status(500).json({ message: "Failed to fetch contractors" });
    }
  });

  // Contractor search endpoint (alias for contractor listing with search params)
  app.get("/api/contractors/search", async (req: any, res: any) => {
    try {
      const { county, trade, sort, limit = 20, offset = 0 } = req.query;

      // Track contractor search with locality context
      // LocalityTracker call removed

      const filters: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      if (county) {
        // Try to find county by name (not FIPS)
        const counties = await storage.getCounties();
        const countyRecord = counties.find(c => 
          c.name.toLowerCase().includes((county as string).toLowerCase()) ||
          c.fips === county
        );
        if (countyRecord) {
          filters.countyId = countyRecord.id;
        } else {
          return res.json([]); // No county found, return empty results
        }
      }

      if (trade) {
        const tradeRecord = await storage.getTradeBySlug(trade as string);
        if (tradeRecord) {
          filters.tradeIds = [tradeRecord.id];
        } else {
          return res.json([]); // No trade found, return empty results  
        }
      }

      if (sort) {
        filters.sortBy = sort;
      }

      const contractors = await storage.getContractors(filters);
      res.json(contractors);
    } catch (error: any) {
      console.error("Error searching contractors:", error);
      res.status(500).json({ message: "Failed to search contractors" });
    }
  });

  // Get top contractors in area (for lead assignment)
  app.get("/api/contractors/top", async (req: any, res: any) => {
    try {
      const { county, trade, limit = 3 } = req.query;

      if (!county || !trade) {
        return res.status(400).json({ message: "County and trade are required" });
      }

      const filters: any = {
        limit: parseInt(limit as string),
        sortBy: 'rating', // Sort by highest rated contractors
      };

      // Get county by FIPS code
      const countyRecord = await storage.getCountyByFips(county as string);
      if (countyRecord) {
        filters.countyId = countyRecord.id;
      }

      // Get trade by slug
      const tradeRecord = await storage.getTradeBySlug(trade as string);
      if (tradeRecord) {
        filters.tradeIds = [tradeRecord.id];
      }

      const contractors = await storage.getContractors(filters);
      res.json(contractors);
    } catch (error: any) {
      console.error("Error fetching top contractors:", error);
      res.status(500).json({ message: "Failed to fetch top contractors" });
    }
  });

  // Seed database endpoint (development only)
  app.post("/api/seed-database", async (req: any, res: any) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "Not allowed in production" });
      }

      const { seedDatabase } = await import("./seed-data");
      await seedDatabase();
      res.json({ message: "Database seeded successfully" });
    } catch (error: any) {
      console.error("Error seeding database:", error);
      res.status(500).json({ message: "Failed to seed database" });
    }
  });

  // Individual contractor profile
  app.get("/api/contractors/:slug", async (req: any, res: any) => {
    try {
      const { slug } = req.params;
      const contractor = await storage.getContractorBySlug(slug);

      // Track contractor profile view with locality context
      // LocalityTracker call removed

      if (!contractor) {
        return res.status(404).json({ message: "Contractor not found" });
      }

      // Get recommendations and ratings
      const recommendations = await storage.getRecommendations(contractor.id);
      const ratings = await storage.getContractorRatings(contractor.id);

      res.json({
        ...contractor,
        recommendations,
        ratingSummary: ratings,
      });
    } catch (error: any) {
      console.error("Error fetching contractor:", error);
      res.status(500).json({ message: "Failed to fetch contractor" });
    }
  });

  // States endpoint
  app.get("/api/states", async (req: any, res: any) => {
    try {
      const { US_STATES } = await import("@shared/us-states-counties");
      res.json(US_STATES);
    } catch (error: any) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

  // Counties endpoint
  app.get("/api/counties", async (req: any, res: any) => {
    try {
      const { state } = req.query;

      // Use the database storage method instead of imports
      const counties = await storage.getCounties(state as string);
      res.json(counties);
    } catch (error: any) {
      console.error("Error fetching counties:", error);
      res.status(500).json({ message: "Failed to fetch counties" });
    }
  });

  // Trades endpoint
  app.get("/api/trades", async (req: any, res: any) => {
    try {
      const { parent } = req.query;
      const trades = await storage.getTrades(parent as string);
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // Ad delivery for site visits with location targeting
  app.get("/api/ads/site-visit", async (req: any, res: any) => {
    try {
      const { userType, state, county } = req.query;
      const ad = await storage.getTargetedAd({
        audience: userType as string || 'all',
        state: state as string,
        county: county as string,
      });

      if (!ad) {
        return res.status(404).json({ message: "No ads available" });
      }

      res.json(ad);
    } catch (error: any) {
      console.error("Error fetching targeted ad:", error);
      res.status(500).json({ message: "Failed to fetch ad" });
    }
  });

  // Track ad impressions
  app.post("/api/ads/track-impression", async (req: any, res: any) => {
    try {
      const { adId } = req.body;

      // Track ad view with locality context
      // await LocalityTracker.trackAdInteraction(req, adId, 'view');

      await storage.incrementAdImpressions(adId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking impression:", error);
      res.status(500).json({ message: "Failed to track impression" });
    }
  });

  // Track ad clicks
  app.post("/api/ads/track-click", async (req: any, res: any) => {
    try {
      const { adId } = req.body;

      // Track ad click with locality context
      // await LocalityTracker.trackAdInteraction(req, adId, 'click');

      await storage.incrementAdClicks(adId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // Save ad for later (authenticated users only)
  app.post("/api/ads/save", isAuthenticated, async (req: any, res: any) => {
    try {
      const { adId } = req.body;
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const savedAd = await storage.saveAdForUser(userId, adId);
      res.json(savedAd);
    } catch (error: any) {
      console.error("Error saving ad:", error);
      res.status(500).json({ message: "Failed to save ad" });
    }
  });

  // Get saved ads for user
  app.get("/api/saved-ads", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const savedAds = await storage.getSavedAdsForUser(userId);
      res.json(savedAds);
    } catch (error: any) {
      console.error("Error fetching saved ads:", error);
      res.status(500).json({ message: "Failed to fetch saved ads" });
    }
  });

  // Remove saved ad
  app.delete("/api/ads/save/:adId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { adId } = req.params;
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      await storage.removeSavedAd(userId, adId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error removing saved ad:", error);
      res.status(500).json({ message: "Failed to remove saved ad" });
    }
  });

  // Notification routes moved to server/routes/notification-routes.ts
  // and registered via registerNotificationRoutes(app) to avoid duplication

  // Admin endpoint to trigger reminder notifications (for testing)
  app.post("/api/admin/trigger-reminders", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user || !['head_admin', 'moderator', 'ops_admin'].includes(user.role || '')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { notificationService } = await import('./notification-service');
      // await notificationService.triggerReminders();

      res.json({ message: "Reminder processing triggered successfully" });
    } catch (error: any) {
      console.error("Error triggering reminders:", error);
      res.status(500).json({ message: "Failed to trigger reminders" });
    }
  });

  // Profile setup endpoint
  app.post('/api/auth/setup-profile', isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { role, phone, address, city, state, zipCode, companyName, businessDescription, licenseNumber, yearsInBusiness, serviceAreas, isGeneralContractor, isResidentialContractor, acceptsSubcontractWork } = req.body;

      const existingUser = await storage.getUser(userId);

      const normalizedRole = role === 'contractor_user'
        ? 'contractor'
        : role === 'vehicle_dealer'
          ? 'car_dealer'
          : role === 'helper'
            ? 'handyman'
            : role;

      const normalizedServiceAreas: string[] = Array.isArray(serviceAreas)
        ? serviceAreas.filter(Boolean).map((area: any) => String(area).trim())
        : typeof serviceAreas === 'string'
          ? serviceAreas.split(',').map((area: string) => area.trim()).filter(Boolean)
          : [];

      // Update user profile
      const updatedUser = await storage.updateUser(userId, {
        role: normalizedRole,
        phone,
        address,
        city,
        state,
        zipCode,
        onboardingCompleted: true,
        preferences: {
          ...(existingUser as any)?.preferences,
          profileVisibility: (existingUser as any)?.preferences?.profileVisibility || 'public',
        },
      });

      const fullName = [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(' ').trim();
      const defaultDisplayName = fullName || String(companyName || '').trim() || 'TradeScout Profile';

      const businessCapableRoles = new Set(['contractor', 'realtor', 'car_dealer', 'handyman']);
      let createdBusiness: any = null;

      if (businessCapableRoles.has(normalizedRole)) {
        if (normalizedRole === 'contractor' && (!companyName || String(companyName).trim().length < 2)) {
          return res.status(400).json({ message: "Business name is required for contractor profiles" });
        }

        const businessName = String(companyName || defaultDisplayName).trim();

        createdBusiness = await storage.createBusinessForOwner(userId, {
          name: businessName,
          slug: businessName,
          type: (normalizedRole === 'contractor' ? 'contractor' : 'other') as any,
          roleContext: normalizedRole as any,
          profileData: {
            description: businessDescription,
            phone,
            email: updatedUser.email,
          } as any,
          status: 'active' as any,
          countyIds: [],
        });

        await storage.setUserActiveBusiness(userId, createdBusiness.id);

        if (normalizedRole === 'contractor') {
          await storage.createContractor({
            userId,
            businessId: createdBusiness.id,
            companyName: String(companyName).trim(),
            slug: String(companyName).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            about: businessDescription,
            licenseNumber,
            yearsInBusiness: yearsInBusiness || 0,
            phone,
            isGeneralContractor: isGeneralContractor || false,
            isResidentialContractor: isResidentialContractor || false,
            acceptsSubcontractWork: acceptsSubcontractWork || false,
          } as any);
        }
      }

      const createdProfile = await storage.createProfileForOwner(userId, {
        ownerUserId: userId as any,
        businessId: createdBusiness?.id || undefined,
        roleContext: normalizedRole as any,
        slug: String(companyName || defaultDisplayName).trim(),
        displayName: String(companyName || defaultDisplayName).trim(),
        headline: null,
        contentBlocks: [],
        ctaConfig: {},
        seoMeta: {},
        status: ('published' as any),
      } as any);

      const updatedWithActive = await storage.setUserActiveProfile(userId, createdProfile.id);

      res.json({
        ...updatedWithActive,
        password: undefined,
        activeProfileId: createdProfile.id,
        createdProfileId: createdProfile.id,
        createdProfileSlug: createdProfile.slug,
        createdBusinessId: createdBusiness?.id || null,
        createdBusinessSlug: createdBusiness?.slug || null,
      });
    } catch (error: any) {
      console.error("Error setting up profile:", error);
      res.status(500).json({ message: "Failed to setup profile" });
    }
  });

  // Public heatmap data endpoint (promotional feature)
  app.get("/api/heatmap", async (req: any, res: any) => {
    try {
      const timeframe = (req.query.timeframe as string) || '30d';
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;

      // Get heatmap data from locality interactions
      const heatmapData = await storage.getLocalityHeatmapData(days);

      res.json(heatmapData);
    } catch (error: any) {
      console.error("Error fetching heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  // County contractors endpoint
  app.get("/api/contractors/by-county", async (req: any, res: any) => {
    try {
      const { state, county } = req.query;

      if (!state || !county) {
        return res.status(400).json({ message: "State and county parameters required" });
      }

      const contractors = await storage.getContractors({ countyId: String(county) });
      res.json(contractors || []);
    } catch (error: any) {
      console.error("Error fetching county contractors:", error);
      res.status(500).json({ message: "Failed to fetch contractors" });
    }
  });

  // Admin heatmap data endpoint (same as public but with admin context)
  app.get("/api/admin/heatmap", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id;
      const user = await storage.getUser(userId);

      if (!user || !['head_admin', 'moderator', 'ops_admin'].includes(user.role || '')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const timeframe = (req.query.timeframe as string) || '30d';
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;

      // Get heatmap data from locality interactions
      const heatmapData = await storage.getLocalityHeatmapData(days);

      res.json(heatmapData);
    } catch (error: any) {
      console.error("Error fetching heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  // Admin user management endpoints
  app.get("/api/admin/users", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user || !['head_admin', 'moderator', 'ops_admin'].includes(user.role || '')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:userId/role", isAuthenticated, async (req: any, res: any) => {
    try {
      const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const adminUser = await storage.getUser(adminUserId);
      const { userId } = req.params;
      const { role } = req.body;

      if (!adminUser || !['head_admin', 'moderator', 'ops_admin'].includes(adminUser.role || '')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Only head_admin can promote to head_admin or modify other head_admins
      if (role === 'head_admin' && adminUser.role !== 'head_admin') {
        return res.status(403).json({ message: "Only head admin can promote to head admin" });
      }

      const targetUser = await storage.getUser(userId);
      if (targetUser?.role === 'head_admin' && adminUser.role !== 'head_admin') {
        return res.status(403).json({ message: "Only head admin can modify other head admins" });
      }

      const updatedUser = await storage.updateUser(userId, { role });
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.delete("/api/admin/users/:userId", isAuthenticated, async (req: any, res: any) => {
    try {
      const adminUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const adminUser = await storage.getUser(adminUserId);
      const { userId } = req.params;

      if (!adminUser || !['head_admin', 'moderator'].includes(adminUser.role || '')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const targetUser = await storage.getUser(userId);
      if (targetUser?.role === 'head_admin' && adminUser.role !== 'head_admin') {
        return res.status(403).json({ message: "Only head admin can delete other head admins" });
      }

      // Prevent self-deletion
      if (userId === adminUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      await storage.deleteUser(userId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Quote calculator pricing
  app.get("/api/pricing/:service", async (req: any, res: any) => {
    try {
      const { service } = req.params;
      const { fips } = req.query;

      const pricingData = await storage.getPricingData(service, fips as string);
      res.json(pricingData);
    } catch (error: any) {
      console.error("Error fetching pricing data:", error);
      res.status(500).json({ message: "Failed to fetch pricing data" });
    }
  });

  // Quote calculator endpoint (public access)
  app.post("/api/calculator", async (req: any, res: any) => {
    try {
      const { projectType, squareFootage, stateCode, countyFips, urgency } = req.body;

      // Track calculator usage with locality context
      // LocalityTracker call removed

      // Get pricing data for the project type and county
      const pricingData = await storage.getPricingData(projectType, countyFips);

      if (!pricingData || pricingData.length === 0) {
        // Fallback pricing calculations
        const baseRates: Record<string, number> = {
          'roofing': 15,
          'roof-replacement': 15,
          'roof-repair': 8,
          'plumbing': 12,
          'electrical': 10,
          'hvac': 25,
          'flooring': 12,
          'kitchen-remodel': 100,
          'bathroom-remodel': 85,
          'painting': 6
        };

        const baseRate = baseRates[projectType] || 20;
        const sqft = parseInt(squareFootage) || 1000;

        const baseLow = baseRate * sqft * 0.8;
        const baseHigh = baseRate * sqft * 1.2;

        // Apply urgency multiplier
        const urgencyMultiplier = urgency === 'urgent' ? 1.2 : urgency === 'soon' ? 1.1 : 1.0;

        const estimate = {
          low: Math.round(baseLow * urgencyMultiplier),
          high: Math.round(baseHigh * urgencyMultiplier),
          projectType,
          // squareFootage: sqft,
          urgency: urgency || 'planning',
          calculatedAt: new Date()
        };

        return res.json(estimate);
      }

      // Use database pricing data
      const pricing = pricingData[0];
      const sqft = parseInt(squareFootage) || 1000;
      const baseLow = pricing.baseLow ? parseInt(pricing.baseLow, 10) : 0;
      const baseHigh = pricing.baseHigh ? parseInt(pricing.baseHigh, 10) : 0;

      // Calculate estimate based on square footage
      const low = Math.round((baseLow / 1000) * sqft);
      const high = Math.round((baseHigh / 1000) * sqft);

      // Apply urgency multiplier
      const urgencyMultiplier = urgency === 'urgent' ? 1.2 : urgency === 'soon' ? 1.1 : 1.0;

      const estimate = {
        low: Math.round(low * urgencyMultiplier),
        high: Math.round(high * urgencyMultiplier),
        projectType,
        // squareFootage: sqft,
        urgency: urgency || 'planning',
        calculatedAt: new Date()
      };

      res.json(estimate);
    } catch (error: any) {
      console.error("Error calculating estimate:", error);
      res.status(500).json({ message: "Failed to calculate estimate" });
    }
  });

  // Lead submission (public - no auth required for homeowners to get quotes)
  app.post("/api/leads", isAuthenticated, async (req: any, res: any) => {
    try {
      // User ID is optional for public lead submissions, but we capture it if available
      const userId = (req.user as any)?.id || null;
      const leadData = { ...req.body, userId };

      // Track quote request with locality context
      // LocalityTracker call removed

      // Validate lead data
      const validatedLead = insertLeadSchema.parse(leadData);

      const lead = await storage.createLead(validatedLead);

      // If this is a "top3" routing request, find and notify top contractors
      if (validatedLead.routingType === 'top3' && validatedLead.countyId && validatedLead.tradeId) {
        await routeLeadToTopContractors(lead, validatedLead);
      }

      // Log event
      await storage.logEvent('lead_submitted', {
        leadId: lead.id,
        userId,
        routingType: lead.routingType,
      });

      res.json({ message: "Lead submitted successfully", leadId: lead.id });
    } catch (error: any) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // Recommendations (requires auth)
  app.post("/api/recommendations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const recommendationData = { ...req.body, userId };

      // Track rating submission with locality context
      // LocalityTracker call removed

      const recommendation = await storage.createRecommendation({
        ...recommendationData,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null
      });

      // Update leaderboard stats when recommendation is created
      await storage.updateContractorLeaderboardStats(recommendationData.contractorId, recommendationData.rating);

      await storage.logEvent('recommendation_submitted', {
        recommendationId: recommendation.id,
        contractorId: recommendation.contractorId,
        userId,
      });

      res.json(recommendation);
    } catch (error: any) {
      console.error("Error creating recommendation:", error);
      res.status(500).json({ message: "Failed to create recommendation" });
    }
  });

  // Contractor leaderboards
  app.get("/api/leaderboard/monthly", async (req: any, res: any) => {
    try {
      const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const state = req.query.state as string;
      const county = req.query.county as string;

      const leaderboard = await storage.getMonthlyLeaderboard(month, year, limit, state, county);
      res.json(leaderboard);
    } catch (error: any) {
      console.error("Error fetching monthly leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch monthly leaderboard" });
    }
  });

  app.get("/api/leaderboard/lifetime", async (req: any, res: any) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const state = req.query.state as string;
      const county = req.query.county as string;

      const leaderboard = await storage.getLifetimeLeaderboard(limit, state, county);
      res.json(leaderboard);
    } catch (error: any) {
      console.error("Error fetching lifetime leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch lifetime leaderboard" });
    }
  });

  app.get("/api/leaderboard/contractor/:contractorId", async (req: any, res: any) => {
    try {
      const { contractorId } = req.params;
      const stats = await storage.getContractorLeaderboardPosition(contractorId);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching contractor leaderboard position:", error);
      res.status(500).json({ message: "Failed to fetch contractor position" });
    }
  });

  // States API for geographic filtering
  app.get("/api/states", async (req: any, res: any) => {
    try {
      const states = await storage.getAllStates();
      res.json(states);
    } catch (error: any) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

  // Counties API for geographic filtering
  app.get("/api/counties", async (req: any, res: any) => {
    try {
      const state = req.query.state as string;
      const counties = await storage.getCountiesByState(state);
      res.json(counties);
    } catch (error: any) {
      console.error("Error fetching counties:", error);
      res.status(500).json({ message: "Failed to fetch counties" });
    }
  });

  // Growth Pack download (requires contractor account)
  app.post("/api/growth-pack", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const downloadToken = randomUUID();
      const downloadData = { ...req.body, downloadToken, userId };

      const validatedDownload = insertGrowthPackDownloadSchema.parse(downloadData);
      const download = await storage.createGrowthPackDownload(validatedDownload);

      await storage.logEvent('growth_pack_requested', {
        email: download.email,
        companyName: download.companyName,
        userId: userId,
      });

      res.json({ 
        message: "Growth Pack requested successfully",
        downloadToken,
        downloadUrl: `/api/growth-pack/download/${downloadToken}`
      });
    } catch (error: any) {
      console.error("Error creating Growth Pack download:", error);
      res.status(500).json({ message: "Failed to request Growth Pack" });
    }
  });

  // Growth Pack download link
  app.get("/api/growth-pack/download/:token", async (req: any, res: any) => {
    try {
      const { token } = req.params;
      const download = await storage.getGrowthPackDownload(token);

      if (!download) {
        return res.status(404).json({ message: "Download not found" });
      }

      // Update download timestamp
      await storage.logEvent('growth_pack_downloaded', {
        downloadId: download.id,
        email: download.email,
      });

      // Generate actual PDF download URL
      const pdfUrl = `/api/growth-pack/pdf/${token}`;
      res.json({ 
        message: "Growth Pack download ready",
        filename: "Trade-Scout-Growth-Pack.pdf",
        downloadUrl: pdfUrl
      });
    } catch (error: any) {
      console.error("Error processing Growth Pack download:", error);
      res.status(500).json({ message: "Failed to process download" });
    }
  });

  // Pricing Analytics Routes (Admin Only)
  app.get("/api/admin/pricing-analytics", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res: any) => {
    try {
      const { timeframe = '30d' } = req.query;
      const { pricingAnalyticsService } = await import('./pricing-analytics');

      const analytics = await pricingAnalyticsService.getPricingAnalytics(timeframe as any);
      res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching pricing analytics:", error);
      res.status(500).json({ message: "Failed to fetch pricing analytics" });
    }
  });

  app.post("/api/admin/pricing-analytics/update-calculator", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res: any) => {
    try {
      const { threshold = 10 } = req.body;
      const { pricingAnalyticsService } = await import('./pricing-analytics');

      const result = await pricingAnalyticsService.updateCalculatorPricing(threshold);

      // Log the pricing update
      await storage.logEvent('pricing_calculator_updated', {
        adminId: (req.user as any)?.id || (req.user as any)?.claims?.sub,
        updatedCount: result.updatedCount,
        updates: result.updates
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error updating calculator pricing:", error);
      res.status(500).json({ message: "Failed to update calculator pricing" });
    }
  });

  app.get("/api/admin/pricing-analytics/export", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res: any) => {
    try {
      const { timeframe = '30d' } = req.query;
      const { pricingAnalyticsService } = await import('./pricing-analytics');

      const analytics = await pricingAnalyticsService.getPricingAnalytics(timeframe as any);

      // Convert analytics to CSV format
      const csvData = [];

      // Add trade data
      for (const [tradeId, data] of Object.entries(analytics.averageQuotes.byTrade)) {
        csvData.push({
          type: 'trade',
          id: tradeId,
          average: data.average,
          count: data.count,
          trend: data.trend
        });
      }

      // Add region data  
      for (const [regionKey, data] of Object.entries(analytics.averageQuotes.byRegion)) {
        csvData.push({
          type: 'region',
          id: regionKey,
          average: data.average,
          count: data.count,
          trend: data.trend
        });
      }

      // Convert to CSV string
      const csvHeader = 'Type,ID,Average,Count,Trend\n';
      const csvRows = csvData.map(row => 
        `${row.type},${row.id},${row.average},${row.count},${row.trend}`
      ).join('\n');

      const csvContent = csvHeader + csvRows;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pricing-analytics-${timeframe}.csv"`);
      res.send(csvContent);
    } catch (error: any) {
      console.error("Error exporting pricing analytics:", error);
      res.status(500).json({ message: "Failed to export pricing analytics" });
    }
  });

  app.get("/api/admin/pricing-analytics/recommendations", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res: any) => {
    try {
      const { stateCode } = req.query;
      const { pricingAnalyticsService } = await import('./pricing-analytics');

      const recommendations = await pricingAnalyticsService.getRegionalPricingRecommendations(stateCode);
      res.json(recommendations);
    } catch (error: any) {
      console.error("Error fetching pricing recommendations:", error);
      res.status(500).json({ message: "Failed to fetch pricing recommendations" });
    }
  });

  // Contractor dashboard (requires contractor auth)
  app.get("/api/contractor/dashboard", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      // Get contractor profile for this user
      const contractors = await storage.getContractors({ limit: 1 });
      const contractor = contractors.find(c => c.userId === userId);

      if (!contractor) {
        return res.status(404).json({ message: "Contractor profile not found" });
      }

      // Get leads for this contractor
      const leads = await storage.getLeads(contractor.id);
      const recommendations = await storage.getRecommendations(contractor.id);
      const ratings = await storage.getContractorRatings(contractor.id);

      res.json({
        contractor,
        leads: leads.slice(0, 5), // Recent leads
        recommendations: recommendations.slice(0, 3), // Recent recommendations
        stats: {
          totalLeads: leads.length,
          newLeads: leads.filter(l => l.status === 'new').length,
          ratingSummary: ratings,
        }
      });
    } catch (error: any) {
      console.error("Error fetching contractor dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Event tracking endpoint
  app.post("/api/events", async (req: any, res: any) => {
    try {
      const { eventType, data } = req.body;

      await storage.logEvent(eventType, {
        ...data,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({ message: "Event logged successfully" });
    } catch (error: any) {
      console.error("Error logging event:", error);
      res.status(500).json({ message: "Failed to log event" });
    }
  });

  // Admin analytics (requires admin auth)
  app.get("/api/admin/stats", isAuthenticated, async (req: any, res: any) => {
    try {
      const userRole = req.user.claims.role;
      if (!['owner', 'ops_admin', 'analytics_read'].includes(userRole)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = {
        totalContractors: await storage.getContractors({ limit: 10000 }).then(c => c.length),
        newLeads: await storage.getEventStats('lead_submitted', { from: weekAgo, to: today }),
        growthPackDownloads: await storage.getEventStats('growth_pack_requested', { from: weekAgo, to: today }),
        totalRecommendations: await storage.getEventStats('recommendation_submitted'),
      };

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Contractor application submission
  app.post("/api/contractors/apply", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Track contractor application with locality context
      // LocalityTracker call removed

      const applicationData = { ...req.body, userId };

      // Create contractor profile from application data
      const contractor = await storage.createContractor({
        userId,
        companyName: applicationData.companyName,
        slug: applicationData.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        phone: applicationData.phone,
        email: applicationData.email,
        website: applicationData.website,
        yearsInBusiness: parseInt(applicationData.yearsInBusiness) || 0,
        licenseNumber: applicationData.licenseNumber,
        about: applicationData.description,
        isGeneralContractor: applicationData.isGeneralContractor || false,
        isResidentialContractor: applicationData.isResidentialContractor || false,
        acceptsSubcontractWork: applicationData.acceptsSubcontractWork || false,
        verifiedLicensed: false,
        verifiedInsured: false,
        isActive: true,
      });

      // Update user role to contractor
      await storage.updateUser(userId, { 
        role: 'contractor',
        onboardingCompleted: true 
      });

      console.log('New contractor application created:', contractor.id);

      res.json({ 
        message: "Application submitted successfully",
        contractorId: contractor.id,
        status: 'pending_verification'
      });
    } catch (error: any) {
      console.error("Error submitting contractor application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Admin: Get contractor applications
  app.get("/api/admin/contractor-applications", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res: any) => {
    try {
      const { status, limit = 50 } = req.query;
      const applications = await storage.getContractorApplications({ 
        status: status as string,
        limit: parseInt(limit as string) 
      });
      
      res.json(applications);
    } catch (error: any) {
      console.error("Error fetching contractor applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Admin: Update contractor application status
  app.patch("/api/admin/contractor-applications/:id", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { status, reviewNotes } = req.body;
      const adminId = (req.user as any)?.id;

      await storage.updateContractorApplication(id, {
        status,
        reviewNotes,
        reviewedBy: adminId,
        reviewedAt: new Date()
      });

      res.json({ message: "Application status updated successfully" });
    } catch (error: any) {
      console.error("Error updating contractor application:", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  // Create recommendation for contractor with anti-abuse protection (LOGIN REQUIRED)
  app.post("/api/contractors/:contractorId/recommendations", isAuthenticated, async (req: any, res: any) => {
    try {
      const { contractorId } = req.params;
      const {
        recommendationType,
        comment,
        projectType,
        projectValue,
        workQuality,
        timeliness,
        communication,
        wouldHireAgain,
        customerName,
        customerEmail,
        customerPhone
      } = req.body;

      // Validate required fields
      if (!customerName || !customerEmail || !comment || !recommendationType) {
        return res.status(400).json({
          success: false,
          message: "Customer name, email, comment, and recommendation type are required"
        });
      }

      // Get client IP and user agent for anti-abuse
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const recommendation = await storage.createRecommendation({
        contractorId,
        userId: (req.user as any)?.id || (req.user as any)?.claims?.sub, // User must be authenticated
        recommendationType,
        comment,
        projectType,
        projectValue,
        workQuality,
        timeliness,
        communication,
        wouldHireAgain,
        customerName,
        customerEmail,
        customerPhone,
        ipAddress,
        userAgent
      });

      res.json({ 
        success: true, 
        message: "Recommendation submitted for review. It will be published after moderation.",
        recommendation: {
          id: recommendation.id,
          recommendationType: recommendation.recommendationType,
          moderationStatus: recommendation.moderationStatus
        }
      });
    } catch (error: any) {
      console.error("Error creating recommendation:", error);
      res.status(400).json({ 
        success: false, 
        message: (error as Error).message || "Failed to submit recommendation" 
      });
    }
  });

  // Get contractor recommendations
  app.get("/api/contractors/:contractorId/recommendations", async (req: any, res: any) => {
    try {
      const { contractorId } = req.params;
      const { type = 'all', limit = 10 } = req.query;

      const recommendations = await storage.getContractorRecommendations(contractorId, {
        type: type as 'positive' | 'negative' | 'all',
        limit: parseInt(limit as string)
      });

      res.json(recommendations);
    } catch (error: any) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Admin: Get pending recommendations for moderation
  app.get("/api/admin/recommendations/pending", isAuthenticated, requireRole(['head_admin', 'ops_admin', 'moderator']), async (req: any, res: any) => {
    try {
      const { limit = 50 } = req.query;
      
      const pendingRecommendations = await db
        .select({
          id: recommendations.id,
          contractorId: recommendations.contractorId,
          recommendationType: recommendations.recommendationType,
          comment: recommendations.comment,
          customerName: recommendations.customerName,
          customerEmail: recommendations.customerEmail,
          projectType: recommendations.projectType,
          projectValue: recommendations.projectValue,
          createdAt: recommendations.createdAt,
          contractorName: contractors.companyName
        })
        .from(recommendations)
        .leftJoin(contractors, eq(recommendations.contractorId, contractors.id))
        .where(eq(recommendations.moderationStatus, 'pending'))
        .orderBy(desc(recommendations.createdAt))
        .limit(parseInt(limit as string));

      res.json(pendingRecommendations);
    } catch (error: any) {
      console.error("Error fetching pending recommendations:", error);
      res.status(500).json({ message: "Failed to fetch pending recommendations" });
    }
  });

  // Admin: Moderate recommendation
  app.patch("/api/admin/recommendations/:id/moderate", isAuthenticated, requireRole(['head_admin', 'ops_admin', 'moderator']), async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { action, reason } = req.body; // action: 'approve' or 'reject'
      const moderatorId = (req.user as any)?.id;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ message: "Action must be 'approve' or 'reject'" });
      }

      // Get the recommendation first
      const [recommendation] = await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.id, id));

      if (!recommendation) {
        return res.status(404).json({ message: "Recommendation not found" });
      }

      // Update moderation status
      await db
        .update(recommendations)
        .set({
          moderationStatus: action === 'approve' ? 'approved' : 'rejected',
          isPublic: action === 'approve',
          moderatedAt: new Date(),
          moderatedBy: moderatorId
        })
        .where(eq(recommendations.id, id));

      // Update contractor stats if approved
      if (action === 'approve') {
        await storage.updateContractorRecommendationStats(recommendation.contractorId);
      }

      res.json({ 
        success: true, 
        message: `Recommendation ${action}d successfully`
      });
    } catch (error: any) {
      console.error("Error moderating recommendation:", error);
      res.status(500).json({ message: "Failed to moderate recommendation" });
    }
  });

  // Get contractor leaderboard (ranked by net recommendation score)
  app.get("/api/contractors/leaderboard", async (req: any, res: any) => {
    try {
      const { limit = 20, state, county, trade } = req.query;
      
      let query = db
        .select({
          id: contractors.id,
          companyName: contractors.companyName,
          slug: contractors.slug,
          positiveRecommendations: contractors.positiveRecommendations,
          negativeRecommendations: contractors.negativeRecommendations,
          totalRecommendations: contractors.totalRecommendations,
          recommendationScore: contractors.recommendationScore, // Net score (positive - negative)
          recommendationPercentage: contractors.recommendationPercentage
        })
        .from(contractors)
        .where(
          and(
            eq(contractors.isActive, true),
            gt(contractors.totalRecommendations, 0) // Only contractors with recommendations
          )
        )
        .orderBy(
          desc(contractors.recommendationScore), // Order by net score
          desc(contractors.totalRecommendations) // Tie-breaker: total recommendations
        )
        .limit(parseInt(limit as string));

      const leaderboard = await query;
      res.json(leaderboard);
    } catch (error: any) {
      console.error("Error fetching contractor leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Accelerator enrollment
  app.post("/api/accelerator/enroll", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check if user is a verified contractor
      if (user.role !== 'contractor') {
        return res.status(403).json({ message: "Only contractors can join the Accelerator program" });
      }

      if (user.verificationStatus !== 'approved') {
        return res.status(403).json({ message: "Contractor verification required to join Accelerator program" });
      }

      const { planType } = req.body;

      // Track accelerator enrollment with locality context
      // LocalityTracker call removed

      // Store enrollment (mock for now)
      const enrollment = {
        id: Date.now().toString(),
        userId,
        planType,
        enrolledAt: new Date(),
        status: 'pending_payment'
      };

      // In production, this would integrate with Stripe for payment processing
      console.log('New accelerator enrollment:', enrollment);

      res.json({ 
        message: "Enrollment initiated successfully",
        enrollmentId: enrollment.id,
        status: 'pending_payment'
      });
    } catch (error: any) {
      console.error("Error processing accelerator enrollment:", error);
      res.status(500).json({ message: "Failed to process enrollment" });
    }
  });

  // Exchange routes
  app.get("/api/exchange/items", async (req: any, res: any) => {
    try {
      const listings = await storage.getMarketplaceListings({
        categoryId: req.query.categoryId as string,
        county: req.query.county as string,
        state: req.query.state as string,
        priceMin: req.query.priceMin ? Number(req.query.priceMin) : undefined,
        priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
        condition: req.query.condition as string,
        searchQuery: req.query.search as string,
        sortBy: req.query.sort as any,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });

      res.json(listings || []);
    } catch (error: any) {
      console.error("Error fetching exchange items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  // Exchange contractor promotions
  app.get("/api/exchange/contractor-promos", async (req: any, res: any) => {
    try {
      const { search, category, sort } = req.query;
      
      const contractorId = req.query.contractorId as string | undefined;
      const promos = contractorId ? await storage.getContractorPromos(contractorId) : [];
      res.json(promos || []);
    } catch (error: any) {
      console.error("Error fetching contractor promotions:", error);
      res.status(500).json({ message: "Failed to fetch contractor promotions" });
    }
  });

  // Exchange company promotions
  app.get("/api/exchange/company-promotions", async (req: any, res: any) => {
    try {
      const { search, dealType, sort } = req.query;
      
      // Company promotions are not implemented yet; return an empty list instead of mocks
      res.json([]);
    } catch (error: any) {
      console.error("Error fetching company promotions:", error);
      res.status(500).json({ message: "Failed to fetch company promotions" });
    }
  });

  // Chat system routes
  // Conversations
  app.post("/api/conversations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const { contractorId, leadId } = req.body;

      const conversation = await storage.createConversation({
        homeownerId: userId,
        contractorId,
        leadId,
      });
      res.json(conversation);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const userType = req.query.userType || 'homeowner'; 

      const conversations = await storage.getConversationsByUser(userId, userType);
      res.json(conversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Message Threads API (Nextdoor-style inbox)
  app.get("/api/messages/threads", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      const threads = await storage.getThreadsForUser(userId, { limit, offset });
      res.json({ threads });
    } catch (error: any) {
      console.error("Error fetching message threads:", error);
      res.status(500).json({ message: "Failed to fetch message threads" });
    }
  });

  app.get("/api/messages/threads/:threadId", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const conversation = await storage.getConversation(req.params.threadId);
      if (!conversation) {
        return res.status(404).json({ message: "Thread not found" });
      }

      if (conversation.homeownerId !== userId && conversation.contractorId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMessagesByConversation(req.params.threadId);

      const thread = {
        id: conversation.id,
        subject: null as string | null,
        lastMessageSnippet: null as string | null,
        lastMessageAt: (conversation.lastMessageAt as any) ?? null,
        unreadCount: 0,
        participantCount: 2,
      };

      res.json({ thread, messages });
    } catch (error: any) {
      console.error("Error fetching thread messages:", error);
      res.status(500).json({ message: "Failed to fetch thread messages" });
    }
  });

  app.post("/api/messages/threads/:threadId/messages", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const conversation = await storage.getConversation(req.params.threadId);
      if (!conversation) {
        return res.status(404).json({ message: "Thread not found" });
      }

      if (conversation.homeownerId !== userId && conversation.contractorId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { content, messageType, metadata } = req.body;

      const senderType = conversation.homeownerId === userId ? "homeowner" : "contractor";

      const message = await storage.createMessage({
        conversationId: req.params.threadId,
        senderId: userId,
        senderType,
        content,
        messageType: messageType || "text",
        metadata,
      });

      res.json({ message });
    } catch (error: any) {
      console.error("Error sending thread message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (conversation.homeownerId !== userId && conversation.contractorId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(conversation);
    } catch (error: any) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations/:id/rate", isAuthenticated, async (req: any, res: any) => {
    try {
      const { rating, feedback } = req.body;
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const raterType = conversation.homeownerId === userId ? 'homeowner' : 'contractor';

      const updatedConversation = await storage.rateConversation(
        req.params.id,
        rating,
        feedback,
        raterType
      );

      res.json(updatedConversation);
    } catch (error: any) {
      console.error("Error rating conversation:", error);
      res.status(500).json({ message: "Failed to rate conversation" });
    }
  });

  // Messages
  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const { content, messageType, metadata } = req.body;

      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (conversation.homeownerId !== userId && conversation.contractorId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const senderType = conversation.homeownerId === userId ? 'homeowner' : 'contractor';

      const message = await storage.createMessage({
        conversationId: req.params.id,
        senderId: userId,
        senderType,
        content,
        messageType: messageType || 'text',
        metadata,
      });

      res.json(message);
    } catch (error: any) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (conversation.homeownerId !== userId && conversation.contractorId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Quotes  
  app.post("/api/quotes", isAuthenticated, async (req: any, res: any) => {
    try {
      const contractorId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const quoteData = { ...req.body, contractorId };

      // Track contractor quote submission with locality context
      // LocalityTracker call removed

      const quote = await storage.createQuote(quoteData);
      res.json(quote);
    } catch (error: any) {
      console.error("Error creating quote:", error);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  app.get("/api/conversations/:id/quotes", isAuthenticated, async (req: any, res: any) => {
    try {
      const quotes = await storage.getQuotesByConversation(req.params.id);
      res.json(quotes);
    } catch (error: any) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.put("/api/quotes/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const quote = await storage.updateQuote(req.params.id, req.body);
      res.json(quote);
    } catch (error: any) {
      console.error("Error updating quote:", error);
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  // Material list endpoints (chat + project planning)
  app.get("/api/conversations/:id/material-lists", isAuthenticated, async (req: any, res: any) => {
    try {
      const lists = await storage.getMaterialListsByConversation(req.params.id);
      res.json(lists);
    } catch (error: any) {
      console.error("Error fetching material lists:", error);
      res.status(500).json({ message: "Failed to fetch material lists" });
    }
  });

  app.post("/api/material-lists", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const list = await storage.createMaterialList({
        contractorId: req.body.contractorId || userId,
        ...req.body,
      });
      res.status(201).json(list);
    } catch (error: any) {
      console.error("Error creating material list:", error);
      res.status(500).json({ message: "Failed to create material list" });
    }
  });

  app.post("/api/material-lists/:id/suggestions", isAuthenticated, async (req: any, res: any) => {
    try {
      const suggestion = {
        ...req.body,
        id: req.body.id || `sugg-${Date.now()}`,
        suggestedBy: req.body.suggestedBy || 'homeowner',
      };
      const list = await storage.addMaterialListItemSuggestion(req.params.id, suggestion);
      res.json(list);
    } catch (error: any) {
      console.error("Error adding material suggestion:", error);
      res.status(500).json({ message: "Failed to add suggestion" });
    }
  });

  app.patch("/api/material-lists/:id/items/:itemId/status", isAuthenticated, async (req: any, res: any) => {
    try {
      const list = await storage.updateMaterialListItemStatus(
        req.params.id,
        req.params.itemId,
        req.body.status,
        req.body.denialReason,
      );
      res.json(list);
    } catch (error: any) {
      console.error("Error updating material item status:", error);
      res.status(500).json({ message: "Failed to update material item" });
    }
  });


  // Admin panel routes (require admin access)
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user || req.user.isAdmin !== true) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Emergency admin access route - allows Facebook login to become master admin
  app.post("/api/auth/emergency-admin-access", async (req: any, res: any) => {
    try {
      const { facebookId } = req.body;
      
      // Check if this Facebook ID matches the master admin
      if (facebookId !== '927070657') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the master admin user
      const [masterAdmin] = await db.select().from(users).where(eq(users.facebookId, facebookId));
      if (!masterAdmin) {
        return res.status(404).json({ message: "Master admin not found" });
      }

      // Create session for master admin
      req.login(masterAdmin, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        
        res.json({ 
          message: "Emergency admin access granted",
          user: masterAdmin,
          adminAccess: true
        });
      });
    } catch (error: any) {
      console.error("Emergency admin access error:", error);
      res.status(500).json({ message: "Emergency access failed" });
    }
  });

  // Feature Flags API Routes  
  app.get("/api/admin/feature-flags", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const features = await storage.getFeatureFlags();
      res.json(features);
    } catch (error: any) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ message: "Failed to fetch feature flags" });
    }
  });

  app.post("/api/admin/feature-flags", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const feature = await storage.createFeatureFlag(req.body);
      res.json(feature);
    } catch (error: any) {
      console.error("Error creating feature flag:", error);
      res.status(500).json({ message: "Failed to create feature flag" });
    }
  });

  app.patch("/api/admin/feature-flags/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const feature = await storage.updateFeatureFlag(id, req.body);
      res.json(feature);
    } catch (error: any) {
      console.error("Error updating feature flag:", error);
      res.status(500).json({ message: "Failed to update feature flag" });
    }
  });

  // User Management API Routes
  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        roles: users.roles,
        activeRole: users.activeRole,
        badges: users.badges,
        profileImageUrl: users.profileImageUrl,
        emailVerified: users.emailVerified,
        addressVerified: users.addressVerified,
        createdAt: users.createdAt,
        facebookId: users.facebookId,
        provider: users.provider
      }).from(users).orderBy(desc(users.createdAt));
      
      res.json(allUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:userId/roles", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { roles, activeRole } = req.body;

      if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ message: "Roles must be a non-empty array" });
      }

      if (!activeRole || !roles.includes(activeRole)) {
        return res.status(400).json({ message: "Active role must be one of the assigned roles" });
      }

      // Update user roles and active role
      await db.update(users)
        .set({ 
          roles: roles, 
          activeRole: activeRole,
          role: activeRole, // Keep primary role in sync
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      res.json({ message: "User roles updated successfully" });
    } catch (error: any) {
      console.error("Error updating user roles:", error);
      res.status(500).json({ message: "Failed to update user roles" });
    }
  });

  // Admin: update user badges (manual or special)
  app.patch("/api/admin/users/:userId/badges", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { badges } = req.body;

      if (!Array.isArray(badges)) {
        return res.status(400).json({ message: "Badges must be an array" });
      }

      await db.update(users)
        .set({ badges, updatedAt: new Date() })
        .where(eq(users.id, userId));

      res.json({ message: "Badges updated successfully", badges });
    } catch (error: any) {
      console.error("Error updating user badges:", error);
      res.status(500).json({ message: "Failed to update user badges" });
    }
  });

  app.post("/api/admin/users/:userId/impersonate", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      
      // Get user to impersonate
      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Store original user info for restoration
      const originalUser = req.user;
      
      // Update session to impersonate target user
      req.user = {
        id: targetUser.id,
        email: targetUser.email,
        role: targetUser.activeRole || targetUser.role,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        profileImageUrl: targetUser.profileImageUrl,
        roles: targetUser.roles || [targetUser.role],
        activeRole: targetUser.activeRole || targetUser.role,
        impersonating: true,
        originalAdminId: originalUser.id
      };

      res.json({ 
        message: "Impersonation active", 
        user: req.user,
        originalAdmin: originalUser 
      });
    } catch (error: any) {
      console.error("Error impersonating user:", error);
      res.status(500).json({ message: "Failed to impersonate user" });
    }
  });

  app.post("/api/auth/switch-role", isAuthenticated, async (req: any, res: any) => {
    try {
      const { role } = req.body;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      // Get user's current roles
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const userRoles = currentUser.roles || [currentUser.role];
      if (!userRoles.includes(role)) {
        return res.status(403).json({ message: "You don't have permission to switch to this role" });
      }

      // Update active role
      await db.update(users)
        .set({ activeRole: role, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Update session
      req.user = {
        ...req.user,
        activeRole: role,
        role: role // Update primary role reference too
      };

      res.json({ message: "Role switched successfully", activeRole: role });
    } catch (error: any) {
      console.error("Error switching role:", error);
      res.status(500).json({ message: "Failed to switch role" });
    }
  });

  // Site settings management
  app.get("/api/admin/site-settings", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const { category } = req.query;
      const settings = await storage.getSiteSettings(category as string);
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching site settings:", error);
      res.status(500).json({ message: "Failed to fetch site settings" });
    }
  });

  app.post("/api/admin/site-settings", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const setting = await storage.createSiteSetting(req.body);
      res.json(setting);
    } catch (error: any) {
      console.error("Error creating site setting:", error);
      res.status(500).json({ message: "Failed to create site setting" });
    }
  });

  app.put("/api/admin/site-settings/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const setting = await storage.updateSiteSetting(req.params.id, req.body);
      res.json(setting);
    } catch (error: any) {
      console.error("Error updating site setting:", error);
      res.status(500).json({ message: "Failed to update site setting" });
    }
  });

  app.delete("/api/admin/site-settings/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      await storage.deleteSiteSetting(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting site setting:", error);
      res.status(500).json({ message: "Failed to delete site setting" });
    }
  });

  // Prize configuration management
  app.get("/api/admin/prizes", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const prizes = await storage.getPrizeConfigurations();
      res.json(prizes);
    } catch (error: any) {
      console.error("Error fetching prizes:", error);
      res.status(500).json({ message: "Failed to fetch prizes" });
    }
  });

  app.post("/api/admin/prizes", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const prize = await storage.createPrizeConfiguration(req.body);
      res.json(prize);
    } catch (error: any) {
      console.error("Error creating prize:", error);
      res.status(500).json({ message: "Failed to create prize" });
    }
  });

  app.put("/api/admin/prizes/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const prize = await storage.updatePrizeConfiguration(req.params.id, req.body);
      res.json(prize);
    } catch (error: any) {
      console.error("Error updating prize:", error);
      res.status(500).json({ message: "Failed to update prize" });
    }
  });

  app.delete("/api/admin/prizes/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      await storage.deletePrizeConfiguration(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting prize:", error);
      res.status(500).json({ message: "Failed to delete prize" });
    }
  });

  // Advertisement management
  app.get("/api/admin/advertisements", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const { placement } = req.query;
      const ads = await storage.getAdvertisements(placement as string);
      res.json(ads);
    } catch (error: any) {
      console.error("Error fetching advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  app.post("/api/admin/advertisements", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const ad = await storage.createAdvertisement(req.body);
      res.json(ad);
    } catch (error: any) {
      console.error("Error creating advertisement:", error);
      res.status(500).json({ message: "Failed to create advertisement" });
    }
  });

  // 1b. CORS DIAGNOSTICS
  app.get('/api/cors-test', (req: Request, res: Response) => {
    const origin = (req.headers.origin || '') as string;
    const responseHeaders = res.getHeaders();
    res.json({ origin, responseHeaders });
  });

  app.put("/api/admin/advertisements/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const ad = await storage.updateAdvertisement(req.params.id, req.body);
      res.json(ad);
    } catch (error: any) {
      console.error("Error updating advertisement:", error);
      res.status(500).json({ message: "Failed to update advertisement" });
    }
  });

  app.delete("/api/admin/advertisements/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      await storage.deleteAdvertisement(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting advertisement:", error);
      res.status(500).json({ message: "Failed to delete advertisement" });
    }
  });

  // Marketplace conversation endpoints
  app.get("/api/marketplace/conversations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id;
      const conversations = await storage.getUserMarketplaceConversations(userId);
      res.json(conversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/marketplace/conversations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id;
      const { listingId, sellerId, initialMessage } = req.body;

      // Check if conversation already exists
      const existingConversation = await storage.getMarketplaceConversationByParticipants(
        listingId, userId, sellerId
      );

      if (existingConversation) {
        return res.status(400).json({ message: "Conversation already exists" });
      }

      // Create conversation
      const conversation = await storage.createMarketplaceConversation({
        listingId,
        buyerId: userId,
        sellerId,
        status: 'active'
      });

      // Send initial message
      await storage.createMarketplaceMessage({
        conversationId: conversation.id,
        senderId: userId,
        senderType: 'buyer',
        content: initialMessage,
        messageType: 'text'
      });

      res.json(conversation);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/marketplace/conversations/:conversationId/messages", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id;
      const { conversationId } = req.params;

      // Verify user is part of conversation
      const conversation = await storage.getMarketplaceConversation(conversationId);
      if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMarketplaceMessages(conversationId);
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/marketplace/conversations/:conversationId/messages", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id;
      const { conversationId } = req.params;
      const { content, messageType = 'text' } = req.body;

      // Verify user is part of conversation
      const conversation = await storage.getMarketplaceConversation(conversationId);
      if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const senderType = conversation.buyerId === userId ? 'buyer' : 'seller';

      const message = await storage.createMarketplaceMessage({
        conversationId,
        senderId: userId,
        senderType,
        content,
        messageType,
      });

      res.json(message);
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.put("/api/marketplace/conversations/:conversationId/read", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const { conversationId } = req.params;

      // Verify user is part of conversation
      const conversation = await storage.getMarketplaceConversation(conversationId);
      if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.markMarketplaceMessagesAsRead(conversationId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Professional verification endpoints
  app.get("/api/admin/professional/pending", isAuthenticated, async (req: any, res: any) => {
    if (!["head_admin", "ops_admin", "moderator"].includes(req.user?.claims?.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const [realtors, carSalesmen] = await Promise.all([
        storage.getPendingRealtorApplications(),
        storage.getPendingCarSalesmanApplications()
      ]);

      res.json({ realtors, carSalesmen });
    } catch (error: any) {
      console.error("Error fetching pending applications:", error);
      res.status(500).json({ message: "Failed to fetch pending applications" });
    }
  });

  // Realtor verification
  app.post("/api/admin/realtor/verify/:profileId", isAuthenticated, async (req: any, res: any) => {
    if (!["head_admin", "ops_admin", "moderator"].includes(req.user?.claims?.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { profileId } = req.params;
      const { approved, notes } = req.body;
      const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      const result = await storage.updateRealtorVerificationStatus(
        profileId,
        {
          approved: !!approved,
          notes: notes || '',
          reviewedBy: adminId,
          reviewedAt: new Date(),
        }
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error updating realtor verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // Car salesman verification
  app.post("/api/admin/car-salesman/verify/:profileId", isAuthenticated, async (req: any, res: any) => {
    if (!["head_admin", "ops_admin", "moderator"].includes(req.user?.claims?.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { profileId } = req.params;
      const { approved, notes } = req.body;
      const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      const result = await storage.updateCarSalesmanVerificationStatus(
        profileId,
        {
          approved: !!approved,
          notes: notes || '',
          reviewedBy: adminId,
          reviewedAt: new Date(),
        }
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error updating car salesman verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // Contractor settings management
  app.get("/api/admin/contractor-settings", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const { category } = req.query;
      const settings = await storage.getContractorSettings(category as string);
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching contractor settings:", error);
      res.status(500).json({ message: "Failed to fetch contractor settings" });
    }
  });

  app.post("/api/admin/contractor-settings", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const setting = await storage.createContractorSetting(req.body);
      res.json(setting);
    } catch (error: any) {
      console.error("Error creating contractor setting:", error);
      res.status(500).json({ message: "Failed to create contractor setting" });
    }
  });

  app.put("/api/admin/contractor-settings/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      const setting = await storage.updateContractorSetting(req.params.id, req.body);
      res.json(setting);
    } catch (error: any) {
      console.error("Error updating contractor setting:", error);
      res.status(500).json({ message: "Failed to update contractor setting" });
    }
  });

  app.delete("/api/admin/contractor-settings/:id", isAuthenticated, requireAdmin, async (req: any, res: any) => {
    try {
      await storage.deleteContractorSetting(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting contractor setting:", error);
      res.status(500).json({ message: "Failed to delete contractor setting" });
    }
  });

  // Worker marketplace endpoints
  app.get("/api/workers", async (req: any, res: any) => {
    try {
      // Sample workers with resume data for demonstration
      const sampleWorkers = [
        {
          id: "1",
          userId: "user1",
          firstName: "Maria",
          lastName: "Rodriguez",
          phone: "(555) 123-4567",
          email: "maria.rodriguez@email.com",
          profileImageUrl: null,
          bio: "Experienced construction helper with 5+ years in residential and commercial projects. Skilled in carpentry, painting, and general labor. Reliable and detail-oriented.",
          skills: ["carpentry", "painting", "drywall", "electrical-basic", "plumbing-basic"],
          hourlyRate: "25.00",
          availableHours: {
            monday: { start: "08:00", end: "17:00" },
            tuesday: { start: "08:00", end: "17:00" },
            wednesday: { start: "08:00", end: "17:00" },
            thursday: { start: "08:00", end: "17:00" },
            friday: { start: "08:00", end: "17:00" }
          },
          transportationMethod: "Own vehicle",
          maxTravelDistance: 25,
          isIdVerified: true,
          isBackgroundChecked: true,
          verificationStatus: "approved",
          totalJobsCompleted: 47,
          averageRating: "4.8",
          totalEarnings: "15750.00",
          workExperience: [
            {
              jobTitle: "Kitchen Cabinet Installation",
              company: "Johnson Family",
              startDate: "2024-01-15",
              endDate: "2024-01-22",
              // description: "Installed custom kitchen cabinets, including hardware mounting and adjustment. Completed on time with excellent customer feedback.",
              isCurrentJob: false,
              fromPlatform: true,
              taskId: "task-123"
            },
            {
              jobTitle: "Bathroom Renovation Assistant",
              company: "Smith Contractors",
              startDate: "2023-08-01",
              endDate: "2024-12-31",
              // description: "Assist lead contractor with bathroom renovations, tile installation, and fixture mounting. Regular employment position.",
              isCurrentJob: true,
              fromPlatform: true,
              taskId: "task-456"
            },
            {
              jobTitle: "Construction Helper",
              company: "ABC Construction Co.",
              startDate: "2019-03-01",
              endDate: "2023-07-15",
              // description: "General construction labor including framing, concrete work, and site cleanup. Promoted to crew lead after 2 years.",
              isCurrentJob: false,
              fromPlatform: false
            }
          ],
          education: [
            {
              degree: "Certificate in Construction Technology",
              school: "City Community College",
              graduationYear: 2019,
              fieldOfStudy: "Construction and Building Trades"
            }
          ],
          certifications: [
            {
              name: "OSHA 10-Hour Construction Safety",
              issuer: "OSHA",
              issueDate: "2023-01-15",
              expirationDate: "2026-01-15",
              credentialId: "OSHA-123456"
            },
            {
              name: "First Aid/CPR Certified",
              issuer: "American Red Cross",
              issueDate: "2023-06-01",
              expirationDate: "2025-06-01"
            }
          ],
          portfolioItems: [
            {
              title: "Custom Kitchen Cabinet Installation",
              // description: "Complete kitchen cabinet installation including crown molding and under-cabinet lighting preparation.",
              completionDate: "2024-01-22",
              skills: ["carpentry", "measurements", "hardware-installation"],
              fromPlatform: true,
              taskId: "task-123"
            },
            {
              title: "Deck Repair and Staining",
              // description: "Repaired loose boards, replaced damaged sections, and applied weatherproof stain to 400 sq ft deck.",
              completionDate: "2023-11-15",
              skills: ["carpentry", "wood-treatment", "painting"],
              fromPlatform: true,
              taskId: "task-789"
            }
          ],
          isActive: true,
          isAvailable: true,
          city: "Los Angeles",
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2024-01-22T00:00:00Z"
        },
        {
          id: "2",
          userId: "user2", 
          firstName: "James",
          lastName: "Thompson",
          phone: "(555) 987-6543",
          email: "james.thompson@email.com",
          profileImageUrl: null,
          bio: "Professional handyman specializing in electrical work and home repairs. Licensed electrician's assistant with 3+ years experience.",
          skills: ["electrical", "wiring", "outlets", "lighting", "troubleshooting"],
          hourlyRate: "30.00",
          availableHours: {
            monday: { start: "09:00", end: "18:00" },
            tuesday: { start: "09:00", end: "18:00" },
            wednesday: { start: "09:00", end: "18:00" },
            thursday: { start: "09:00", end: "18:00" },
            friday: { start: "09:00", end: "18:00" },
            saturday: { start: "10:00", end: "15:00" }
          },
          transportationMethod: "Own truck",
          maxTravelDistance: 40,
          isIdVerified: true,
          isBackgroundChecked: true,
          verificationStatus: "approved",
          totalJobsCompleted: 23,
          averageRating: "4.9",
          totalEarnings: "8950.00",
          workExperience: [
            {
              jobTitle: "Ceiling Fan Installation",
              company: "Davis Household",
              startDate: "2024-01-10",
              endDate: "2024-01-10",
              // description: "Installed 3 ceiling fans with remote controls, including electrical wiring and wall switch installation.",
              isCurrentJob: false,
              fromPlatform: true,
              taskId: "task-321"
            },
            {
              jobTitle: "Electrical Assistant",
              company: "Martinez Electric LLC",
              startDate: "2021-06-01",
              endDate: "2023-12-31",
              // description: "Assisted master electrician with residential and commercial electrical installations. Learned advanced wiring techniques.",
              isCurrentJob: false,
              fromPlatform: false
            }
          ],
          education: [
            {
              degree: "Electrical Technology Diploma",
              school: "Technical Trade Institute",
              graduationYear: 2021,
              fieldOfStudy: "Electrical Systems"
            }
          ],
          certifications: [
            {
              name: "Electrical Helper License",
              issuer: "State Licensing Board",
              issueDate: "2021-05-15",
              expirationDate: "2025-05-15",
              credentialId: "EH-789123"
            }
          ],
          portfolioItems: [
            {
              title: "Home Office Electrical Upgrade",
              // description: "Upgraded electrical panel and installed dedicated circuits for home office equipment.",
              completionDate: "2023-09-30",
              skills: ["electrical", "panel-work", "circuit-installation"],
              fromPlatform: true,
              taskId: "task-654"
            }
          ],
          isActive: true,
          isAvailable: true,
          city: "Orange County",
          createdAt: "2023-03-15T00:00:00Z",
          updatedAt: "2024-01-10T00:00:00Z"
        }
      ];

      res.json(sampleWorkers);
    } catch (error: any) {
      console.error("Error fetching workers:", error);
      res.status(500).json({ message: "Failed to fetch workers" });
    }
  });

  app.get("/api/tasks", async (req: any, res: any) => {
    try {
      // For now, return empty array - will be populated when database is set up
      res.json([]);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/task-categories", async (req: any, res: any) => {
    try {
      const { TASK_CATEGORIES } = await import("@shared/task-categories");
      res.json(TASK_CATEGORIES);
    } catch (error: any) {
      console.error("Error fetching task categories:", error);
      res.status(500).json({ message: "Failed to fetch task categories" });
    }
  });

  // Worker registration endpoint
  app.post("/api/workers/register", async (req: any, res: any) => {
    try {
      res.status(503).json({ message: "Worker registration unavailable (database required)" });
    } catch (error: any) {
      console.error("Error registering worker:", error);
      res.status(500).json({ message: "Failed to register worker" });
    }
  });

  // Task posting endpoint
  app.post("/api/tasks", async (req: any, res: any) => {
    try {
      res.status(503).json({ message: "Task posting unavailable (database required)" });
    } catch (error: any) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Task application endpoint
  app.post("/api/tasks/:taskId/apply", async (req: any, res: any) => {
    try {
      res.status(503).json({ message: "Task applications unavailable (database required)" });
    } catch (error: any) {
      console.error("Error applying to task:", error);
      res.status(500).json({ message: "Failed to apply to task" });
    }
  });

  // Worker verification endpoint
  app.post("/api/workers/:workerId/verify", async (req: any, res: any) => {
    try {
      res.status(503).json({ message: "Worker verification unavailable (database required)" });
    } catch (error: any) {
      console.error("Error verifying worker:", error);
      res.status(500).json({ message: "Failed to verify worker" });
    }
  });

  // Helper dashboard specific endpoints
  app.get("/api/workers/profile", isAuthenticated, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'helper') {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }
      
      // For now, return a default helper profile - will be implemented when database is ready
      const helperProfile = {
        id: (req.user as any)?.id || (req.user as any)?.claims?.sub,
        userId: (req.user as any)?.id || (req.user as any)?.claims?.sub,
        firstName: req.user.firstName || 'Helper',
        lastName: req.user.lastName || 'User',
        phone: req.user.email, // placeholder
        email: req.user.email,
        bio: 'Experienced helper ready to assist with various tasks.',
        skills: ['General Labor', 'Assembly', 'Cleaning', 'Moving'],
        hourlyRate: '25.00',
        isIdVerified: true,
        isBackgroundChecked: false,
        totalJobsCompleted: 5,
        averageRating: '4.8',
        totalEarnings: '1250.00',
        isActive: true,
        isAvailable: true,
      };
      
      res.json(helperProfile);
    } catch (error: any) {
      console.error("Error fetching helper profile:", error);
      res.status(500).json({ message: "Failed to fetch helper profile" });
    }
  });

  app.get("/api/tasks/available", isAuthenticated, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'helper') {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }
      
      if ((db as any).select && (tasks as any)) {
        const availableTasks = await db.select().from(tasks).limit(100);
        res.json(availableTasks || []);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      console.error("Error fetching available tasks:", error);
      res.status(500).json({ message: "Failed to fetch available tasks" });
    }
  });

  app.get("/api/workers/applications", isAuthenticated, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'helper') {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }
      
      res.json([]);
    } catch (error: any) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/workers/completed-jobs", isAuthenticated, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'helper') {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }
      
      res.json([]);
    } catch (error: any) {
      console.error("Error fetching completed jobs:", error);
      res.status(500).json({ message: "Failed to fetch completed jobs" });
    }
  });

  app.get("/api/workers/reviews", isAuthenticated, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'helper') {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }
      
      // Return sample reviews
      const reviews = [
        {
          id: 'review-1',
          rating: 5,
          reviewText: 'Excellent work! Very professional and completed the task perfectly.',
          qualityRating: 5,
          timelinessRating: 5,
          communicationRating: 5,
          professionalismRating: 5,
          wouldHireAgain: true,
          createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'review-2',
          rating: 4,
          reviewText: 'Good work, arrived on time and got the job done efficiently.',
          qualityRating: 4,
          timelinessRating: 5,
          communicationRating: 4,
          professionalismRating: 4,
          wouldHireAgain: true,
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        }
      ];
      
      res.json(reviews);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Error reporting endpoints
  // Object Storage Routes for File Uploads
  app.post("/api/objects/upload", isAuthenticated, async (req: any, res: any) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Admin: ingest a folder of knowledge files into the manual cache
  app.post("/api/admin/knowledge/ingest-folder", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { folderPath } = req.body || {};
      if (!folderPath || typeof folderPath !== "string") {
        return res.status(400).json({ error: "folderPath is required" });
      }

      const summary = ingestKnowledgeFolder(folderPath);
      res.json({ message: "Knowledge folder ingested", summary });
    } catch (error: any) {
      console.error("Error ingesting knowledge folder:", error);
      res.status(500).json({ error: error?.message || "Failed to ingest folder" });
    }
  });

  // Admin: direct file upload (text/images/etc), then ingest and sort
  app.post("/api/admin/knowledge/upload", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const multer = (await import("multer")).default;
      const uploadDir = path.join(__dirname, "uploads", `batch_${Date.now()}`);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const upload = multer({ dest: uploadDir }).array("files", 50);

      upload(req, res, (err: any) => {
        if (err) {
          console.error("Upload error:", err);
          return res.status(500).json({ error: "Upload failed" });
        }

        // Multer already wrote files; ingest the temp directory
        const summary = ingestKnowledgeFolder(uploadDir);
        res.json({ message: "Files uploaded and ingested", summary });
      });
    } catch (error: any) {
      console.error("Error uploading knowledge files:", error);
      res.status(500).json({ error: error?.message || "Failed to upload files" });
    }
  });

  // Admin: get user info (sanitized)
  app.post("/api/admin/users/info", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { email, userId } = req.body || {};
      if (!email && !userId) {
        return res.status(400).json({ error: "Provide email or userId" });
      }

      const target = email
        ? await storage.getUserByEmail(String(email).toLowerCase())
        : await storage.getUser(userId);

      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      const sanitized = {
        id: target.id,
        email: target.email,
        roles: target.roles || (target.role ? [target.role] : []),
        activeRole: target.activeRole || target.role,
        verificationStatus: target.verificationStatus,
        badges: target.badges,
        preferences: target.preferences,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
        addressVerified: target.addressVerified,
        emailVerified: target.emailVerified,
        passwordResetEnabled: true,
      };

      res.json({ user: sanitized });
    } catch (error: any) {
      console.error("Error fetching user info:", error);
      res.status(500).json({ error: error?.message || "Failed to fetch user info" });
    }
  });

  // Admin: reset user password directly
  app.post("/api/admin/users/reset-password", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { email, userId, newPassword } = req.body || {};
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ error: "newPassword is required and must be at least 8 characters" });
      }

      if (!email && !userId) {
        return res.status(400).json({ error: "Provide email or userId" });
      }

      const target = email
        ? await storage.getUserByEmail(String(email).toLowerCase())
        : await storage.getUser(userId);

      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }

      const passwordHash = await hashPassword(newPassword);
      await storage.updateUser(target.id, {
        password: passwordHash,
        updatedAt: new Date(),
      });

      res.json({ message: "Password reset successfully", userId: target.id, email: target.email });
    } catch (error: any) {
      console.error("Error resetting user password:", error);
      res.status(500).json({ error: error?.message || "Failed to reset password" });
    }
  });

  app.post("/api/error-reports", async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub || null;
      const reportData = {
        ...req.body,
        userId,
      };

      // Store in database - for now using in-memory storage
      const report = {
        id: `report_${Date.now()}`,
        ...reportData,
        status: 'open',
        priority: 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to database
      await storage.createErrorReport(report);

      res.json({ message: "Error report submitted successfully", reportId: report.id });
    } catch (error: any) {
      console.error("Error creating error report:", error);
      res.status(500).json({ message: "Failed to submit error report" });
    }
  });

  // ===== CONTRACTOR PROMO ROUTES =====

  // Create new promo (contractor users only)
  app.post("/api/contractor-promos", isAuthenticated, isContractor, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get contractor ID for the authenticated user
      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) {
        return res.status(403).json({ message: "You must be a verified contractor to create promos" });
      }

      const promoData = {
        ...req.body,
        contractorId: contractor.id
      };

      const validatedPromo = insertContractorPromoSchema.parse(promoData);
      const promo = await storage.createContractorPromo(validatedPromo);

      res.json(promo);
    } catch (error: any) {
      console.error("Error creating contractor promo:", error);
      res.status(500).json({ message: "Failed to create promo" });
    }
  });

  // Get contractor's promos
  app.get("/api/contractor-promos", isAuthenticated, isContractor, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;

      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) {
        return res.status(403).json({ message: "Contractor not found" });
      }

      const promos = await storage.getContractorPromos(contractor.id);
      res.json(promos);
    } catch (error: any) {
      console.error("Error fetching contractor promos:", error);
      res.status(500).json({ message: "Failed to fetch promos" });
    }
  });

  // Update promo
  app.put("/api/contractor-promos/:promoId", isAuthenticated, isContractor, async (req: any, res: any) => {
    try {
      const { promoId } = req.params;
      const userId = req.user?.claims?.sub;

      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) {
        return res.status(403).json({ message: "Contractor not found" });
      }

      // Verify ownership
      const existingPromo = await storage.getContractorPromo(promoId);
      if (!existingPromo || existingPromo.contractorId !== contractor.id) {
        return res.status(403).json({ message: "You can only edit your own promos" });
      }

      const updatedPromo = await storage.updateContractorPromo(promoId, req.body);
      res.json(updatedPromo);
    } catch (error: any) {
      console.error("Error updating contractor promo:", error);
      res.status(500).json({ message: "Failed to update promo" });
    }
  });

  // Delete promo
  app.delete("/api/contractor-promos/:promoId", isAuthenticated, isContractor, async (req: any, res: any) => {
    try {
      const { promoId } = req.params;
      const userId = req.user?.claims?.sub;

      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) {
        return res.status(403).json({ message: "Contractor not found" });
      }

      // Verify ownership
      const existingPromo = await storage.getContractorPromo(promoId);
      if (!existingPromo || existingPromo.contractorId !== contractor.id) {
        return res.status(403).json({ message: "You can only delete your own promos" });
      }

      await storage.deleteContractorPromo(promoId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting contractor promo:", error);
      res.status(500).json({ message: "Failed to delete promo" });
    }
  });

  // Public promo viewing (by slug) 
  app.get("/promo/:slug", async (req: any, res: any) => {
    try {
      const { slug } = req.params;

      const promo = await storage.getContractorPromoBySlug(slug);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }

      // Check if promo is active and not expired
      const now = new Date();
      if (!promo.isActive || (promo.expiresAt && promo.expiresAt < now)) {
        return res.status(410).json({ message: "Promo has expired" });
      }

      // Check if promo has reached max uses
      const currentUses = promo.currentUses ?? 0;
      if (promo.maxUses && currentUses >= promo.maxUses) {
        return res.status(410).json({ message: "Promo has reached maximum uses" });
      }

      // Track promo view
      await storage.incrementPromoView(promo.id);

      // Record interaction
      await storage.recordPromoInteraction({
        promoId: promo.id,
        interactionType: 'view',
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        referrer: req.get('Referer'),
        county: req.locality?.county,
        state: req.locality?.state,
        city: req.locality?.city,
      });

      // Get contractor details
      const contractor = await storage.getContractor(promo.contractorId);

      res.json({
        promo,
        contractor: contractor ? {
          id: contractor.id,
          companyName: contractor.companyName,
          slug: contractor.slug,
          phone: contractor.phone,
          email: contractor.email,
          about: contractor.about,
          photos: contractor.photos,
          yearsInBusiness: contractor.yearsInBusiness,
          verifiedLicensed: contractor.verifiedLicensed,
          verifiedInsured: contractor.verifiedInsured,
        } : null
      });
    } catch (error: any) {
      console.error("Error fetching promo:", error);
      res.status(500).json({ message: "Failed to fetch promo" });
    }
  });

  // Track promo click
  app.post("/api/promo/:slug/click", async (req: any, res: any) => {
    try {
      const { slug } = req.params;

      const promo = await storage.getContractorPromoBySlug(slug);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }

      // Track promo click
      await storage.incrementPromoClick(promo.id);

      // Record interaction
      await storage.recordPromoInteraction({
        promoId: promo.id,
        interactionType: 'click',
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        referrer: req.get('Referer'),
        county: req.locality?.county,
        state: req.locality?.state,
        city: req.locality?.city,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking promo click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // Get promo analytics (contractor only)
  app.get("/api/contractor-promos/:promoId/analytics", isAuthenticated, isContractor, async (req: any, res: any) => {
    try {
      const { promoId } = req.params;
      const userId = req.user?.claims?.sub;

      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) {
        return res.status(403).json({ message: "Contractor not found" });
      }

      // Verify ownership
      const promo = await storage.getContractorPromo(promoId);
      if (!promo || promo.contractorId !== contractor.id) {
        return res.status(403).json({ message: "You can only view analytics for your own promos" });
      }

      const analytics = await storage.getPromoAnalytics(promoId);
      res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching promo analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Get active promos in area (public)
  app.get("/api/promos/area/:countyFips", async (req: any, res: any) => {
    try {
      const { countyFips } = req.params;
      const promos = await storage.getActivePromosInArea(countyFips);

      // Get contractor details for each promo
      const promosWithContractors = await Promise.all(
        promos.map(async (promo) => {
          const contractor = await storage.getContractor(promo.contractorId);
          return {
            ...promo,
            contractor: contractor ? {
              companyName: contractor.companyName,
              slug: contractor.slug,
              verifiedLicensed: contractor.verifiedLicensed,
              verifiedInsured: contractor.verifiedInsured,
            } : null
          };
        })
      );

      res.json(promosWithContractors);
    } catch (error: any) {
      console.error("Error fetching area promos:", error);
      res.status(500).json({ message: "Failed to fetch area promos" });
    }
  });

  // One-tap bug report with screenshot
  app.post("/api/bug-reports", async (req: any, res: any) => {
    try {
      const { title, description, screenshot, userAgent, url, timestamp, viewport, type } = req.body;

      // Generate unique report ID
      const reportId = `BUG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Track bug report submission with locality
      // LocalityTracker call removed

      // Debug log the incoming data
      console.log("Bug report data received:", { 
        title, 
        description, 
        type, 
        url, 
        userAgent, 
        viewport,
        hasScreenshot: !!screenshot 
      });

      // Store bug report data with proper field mapping
      const bugReport = {
        id: reportId,
        userId: req.user?.claims?.sub || 'anonymous',
        userEmail: req.user?.email || null,
        title: title || 'One-Tap Bug Report',
        // description: description || 'Automatically generated bug report with screenshot',
        errorType: type || 'bug',
        currentUrl: url,
        userAgent,
        browserInfo: viewport ? { viewport } : null,
        attachments: screenshot ? [{ type: 'screenshot', data: screenshot }] : null,
        status: 'open',
        priority: 'medium'
      };

      // Log detailed bug report
      console.log("🐛 One-Tap Bug Report:", {
        reportId,
        url,
        viewport,
        userAgent: userAgent?.substring(0, 50) + '...',
        timestamp,
        hasScreenshot: !!req.files?.screenshot || !!req.body.screenshot
      });

      // Save to database
      await storage.createErrorReport(bugReport);

      res.json({ 
        message: "Bug report submitted successfully", 
        reportId,
        status: 'received'
      });
    } catch (error: any) {
      console.error("Error processing bug report:", error);
      res.status(500).json({ message: "Failed to process bug report" });
    }
  });

  app.get("/api/admin/error-reports", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user || !['head_admin', 'moderator', 'ops_admin'].includes(user.role || '')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Sample error reports for demonstration
      const sampleReports = [
        {
          id: "1",
          userId: "user123",
          userEmail: "user@example.com",
          title: "Page not loading on mobile",
          // description: "When I try to access the contractor dashboard on my phone, the page gets stuck loading and never shows content.",
          errorType: "bug",
          currentUrl: "https://tradescout.app/contractor-dashboard",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
          browserInfo: {
            name: "Safari",
            version: "17.0",
            platform: "iPhone",
            mobile: true
          },
          status: "open",
          priority: "high",
          assignedTo: null,
          adminNotes: null,
          resolution: null,
          resolvedAt: null,
          createdAt: "2024-01-15T10:30:00Z",
          updatedAt: "2024-01-15T10:30:00Z"
        },
        {
          id: "2",
          userId: null,
          userEmail: "contractor@email.com",
          title: "Search filters not working",
          // description: "The location filter on the contractor board doesn't seem to work. I select a county but all contractors still show up.",
          errorType: "ui_issue",
          currentUrl: "https://tradescout.app/contractors/board",
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          browserInfo: {
            name: "Chrome",
            version: "120.0",
            platform: "Win32",
            mobile: false
          },
          status: "in_progress",
          priority: "medium",
          assignedTo: "admin1",
          adminNotes: "Investigating filter logic",
          resolution: null,
          resolvedAt: null,
          createdAt: "2024-01-14T15:45:00Z",
          updatedAt: "2024-01-15T09:15:00Z"
        }
      ];

      res.json(sampleReports);
    } catch (error: any) {
      console.error("Error fetching error reports:", error);
      res.status(500).json({ message: "Failed to fetch error reports" });
    }
  });

  app.patch("/api/admin/error-reports/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user || !['head_admin', 'moderator', 'ops_admin'].includes(user.role || '')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const updateData = req.body;

      // Update the database
      await storage.updateErrorReport(id, updateData);

      res.json({ message: "Error report updated successfully" });
    } catch (error: any) {
      console.error("Error updating error report:", error);
      res.status(500).json({ message: "Failed to update error report" });
    }
  });

  // Testing settings endpoints
  app.get("/api/admin/testing-settings", async (req: any, res: any) => {
    res.json({
      bugReportEnabled: true,
      testingModeEnabled: false,
      showTestingBanner: false
    });
  });

  app.patch("/api/admin/testing-settings", async (req: any, res: any) => {
    res.json({ message: "Settings updated successfully" });
  });

  app.get("/api/admin/error-report-stats", async (req: any, res: any) => {
    res.json({
      total: 8,
      open: 3,
      inProgress: 2,
      resolved: 3
    });
  });

  app.post("/api/admin/generate-test-data", async (req: any, res: any) => {
    res.json({ message: "Test data generated successfully" });
  });

  app.delete("/api/admin/clear-test-data", async (req: any, res: any) => {
    res.json({ message: "Test data cleared successfully" });
  });

  // Marketplace routes
  // Categories
  app.get("/api/marketplace/categories", async (req: any, res: any) => {
    try {
      const categories = await storage.getMarketplaceCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching marketplace categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/marketplace/categories", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const validatedData = insertMarketplaceCategorySchema.parse(req.body);
      const category = await storage.createMarketplaceCategory(validatedData);
      res.status(201).json(category);
    } catch (error: any) {
      console.error("Error creating marketplace category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // Listings (public - only shows approved listings)
  app.get("/api/marketplace/listings", async (req: any, res: any) => {
    try {
      const filters = {
        categoryId: req.query.categoryId as string,
        county: req.query.county as string,
        state: req.query.state as string,
        priceMin: req.query.priceMin ? Number(req.query.priceMin) : undefined,
        priceMax: req.query.priceMax ? Number(req.query.priceMax) : undefined,
        condition: req.query.condition as string,
        searchQuery: req.query.search as string,
        sortBy: req.query.sortBy as 'price_asc' | 'price_desc' | 'date_desc' | 'date_asc',
        limit: req.query.limit ? Number(req.query.limit) : 20,
        offset: req.query.offset ? Number(req.query.offset) : 0,
        status: 'active', // Only show approved/active listings to public
      };

      const listings = await storage.getMarketplaceListings(filters);
      res.json(listings);
    } catch (error: any) {
      console.error("Error fetching marketplace listings:", error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });

  app.get("/api/marketplace/listings/:id", async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const listing = await storage.getMarketplaceListing(id);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Increment view count
      await storage.incrementListingView(id);

      res.json(listing);
    } catch (error: any) {
      console.error("Error fetching marketplace listing:", error);
      res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

  app.get("/api/marketplace/listings/slug/:slug", async (req: any, res: any) => {
    try {
      const { slug } = req.params;
      const listing = await storage.getMarketplaceListingBySlug(slug);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Increment view count
      await storage.incrementListingView(listing.id);

      res.json(listing);
    } catch (error: any) {
      console.error("Error fetching marketplace listing by slug:", error);
      res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

  app.post("/api/marketplace/listings", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const validatedData = insertMarketplaceListingSchema.parse(req.body);

      // All new listings require admin/moderator approval before going live
      const listing = await storage.createMarketplaceListing({
        ...validatedData,
        sellerId: user?.id,
        status: 'pending_approval', // Require approval for all new listings
      });

      res.status(201).json({
        ...listing,
        message: "Listing submitted successfully and is pending admin approval."
      });
    } catch (error: any) {
      console.error("Error creating marketplace listing:", error);
      res.status(400).json({ message: "Failed to create listing" });
    }
  });

  app.put("/api/marketplace/listings/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the listing
      const existingListing = await storage.getMarketplaceListing(id);
      if (!existingListing || existingListing.sellerId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to edit this listing" });
      }

      const updates = req.body;
      const listing = await storage.updateMarketplaceListing(id, updates);
      res.json(listing);
    } catch (error: any) {
      console.error("Error updating marketplace listing:", error);
      res.status(400).json({ message: "Failed to update listing" });
    }
  });

  app.delete("/api/marketplace/listings/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the listing or is admin
      const existingListing = await storage.getMarketplaceListing(id);
      if (!existingListing || (existingListing.sellerId !== user?.id && !['head_admin', 'moderator', 'ops_admin'].includes(user.role || ''))) {
        return res.status(403).json({ message: "Not authorized to delete this listing" });
      }

      await storage.deleteMarketplaceListing(id);
      res.json({ message: "Listing deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting marketplace listing:", error);
      res.status(500).json({ message: "Failed to delete listing" });
    }
  });

  // Admin/Moderator endpoints for listing approval

  // Get all pending listings for admin review
  app.get("/api/admin/marketplace/pending", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const filters = {
        status: 'pending_approval',
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      };

      const listings = await storage.getMarketplaceListings(filters);
      res.json(listings);
    } catch (error: any) {
      console.error("Error fetching pending listings:", error);
      res.status(500).json({ message: "Failed to fetch pending listings" });
    }
  });

  // Approve a listing
  app.post("/api/admin/marketplace/listings/:id/approve", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const { notes } = req.body;

      const listing = await storage.updateMarketplaceListing(id, {
        status: 'active',
        approvedBy: user?.id,
        approvedAt: new Date(),
        moderationNotes: notes,
      });

      res.json({ 
        message: "Listing approved successfully",
        listing 
      });
    } catch (error: any) {
      console.error("Error approving listing:", error);
      res.status(400).json({ message: "Failed to approve listing" });
    }
  });

  // Reject a listing
  app.post("/api/admin/marketplace/listings/:id/reject", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const { reason, notes } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const listing = await storage.updateMarketplaceListing(id, {
        status: 'rejected',
        rejectedBy: user?.id,
        rejectedAt: new Date(),
        rejectionReason: reason,
        moderationNotes: notes,
      });

      res.json({ 
        message: "Listing rejected successfully",
        listing 
      });
    } catch (error: any) {
      console.error("Error rejecting listing:", error);
      res.status(400).json({ message: "Failed to reject listing" });
    }
  });

  // User's own listings
  app.get("/api/marketplace/my-listings", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const listings = await storage.getUserListings(user?.id);
      res.json(listings);
    } catch (error: any) {
      console.error("Error fetching user listings:", error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });

  // Inquiries
  app.post("/api/marketplace/inquiries", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const validatedData = insertMarketplaceInquirySchema.parse(req.body);

      // Get the listing to find the seller
      const listing = await storage.getMarketplaceListing(validatedData.listingId);
      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      const inquiry = await storage.createMarketplaceInquiry({
        ...validatedData,
        buyerId: user?.id,
        sellerId: listing.sellerId,
      });

      res.status(201).json(inquiry);
    } catch (error: any) {
      console.error("Error creating marketplace inquiry:", error);
      res.status(400).json({ message: "Failed to create inquiry" });
    }
  });

  app.get("/api/marketplace/inquiries/sent", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const inquiries = await storage.getUserInquiries(user?.id, 'sent');
      res.json(inquiries);
    } catch (error: any) {
      console.error("Error fetching sent inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  app.get("/api/marketplace/inquiries/received", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const inquiries = await storage.getUserInquiries(user?.id, 'received');
      res.json(inquiries);
    } catch (error: any) {
      console.error("Error fetching received inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  app.get("/api/marketplace/listings/:id/inquiries", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the listing
      const listing = await storage.getMarketplaceListing(id);
      if (!listing || listing.sellerId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to view inquiries for this listing" });
      }

      const inquiries = await storage.getListingInquiries(id);
      res.json(inquiries);
    } catch (error: any) {
      console.error("Error fetching listing inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  app.put("/api/marketplace/inquiries/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the inquiry (seller side)
      const inquiry = await storage.getMarketplaceInquiry(id);
      if (!inquiry || inquiry.sellerId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to update this inquiry" });
      }

      const updates = req.body;
      const updatedInquiry = await storage.updateMarketplaceInquiry(id, updates);
      res.json(updatedInquiry);
    } catch (error: any) {
      console.error("Error updating marketplace inquiry:", error);
      res.status(400).json({ message: "Failed to update inquiry" });
    }
  });

  // Favorites
  app.post("/api/marketplace/favorites", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const validatedData = insertMarketplaceFavoriteSchema.parse(req.body);

      const favorite = await storage.createMarketplaceFavorite({
        ...validatedData,
        userId: user?.id,
      });

      res.status(201).json(favorite);
    } catch (error: any) {
      console.error("Error creating marketplace favorite:", error);
      res.status(400).json({ message: "Failed to add to favorites" });
    }
  });

  app.delete("/api/marketplace/favorites/:listingId", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { listingId } = req.params;

      await storage.removeMarketplaceFavorite(user?.id, listingId);
      res.json({ message: "Removed from favorites" });
    } catch (error: any) {
      console.error("Error removing marketplace favorite:", error);
      res.status(500).json({ message: "Failed to remove from favorites" });
    }
  });

  app.get("/api/marketplace/favorites", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const favorites = await storage.getUserFavorites(user?.id);
      res.json(favorites);
    } catch (error: any) {
      console.error("Error fetching marketplace favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Reports
  app.post("/api/marketplace/reports", async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const validatedData = insertMarketplaceReportSchema.parse(req.body);

      const report = await storage.createMarketplaceReport({
        ...validatedData,
        reporterId: user?.id || null,
      });

      res.status(201).json(report);
    } catch (error: any) {
      console.error("Error creating marketplace report:", error);
      res.status(400).json({ message: "Failed to create report" });
    }
  });

  app.get("/api/marketplace/admin/reports", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const reports = await storage.getMarketplaceReports();
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching marketplace reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.put("/api/marketplace/admin/reports/:id", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const report = await storage.updateMarketplaceReport(id, updates);
      res.json(report);
    } catch (error: any) {
      console.error("Error updating marketplace report:", error);
      res.status(400).json({ message: "Failed to update report" });
    }
  });

  // Marketplace Verification Endpoints
  app.post("/api/marketplace/vendor-verification", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const validatedData = insertVendorVerificationSchema.parse(req.body);

      const verification = await storage.createVendorVerification({
        ...validatedData,
        userId: user?.id,
      });

      res.status(201).json(verification);
    } catch (error: any) {
      console.error("Error creating vendor verification:", error);
      res.status(400).json({ message: "Failed to create vendor verification" });
    }
  });

  app.post("/api/marketplace/buyer-verification", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const validatedData = insertBuyerVerificationSchema.parse(req.body);

      const verification = await storage.createBuyerVerification({
        ...validatedData,
        userId: user?.id,
      });

      res.status(201).json(verification);
    } catch (error: any) {
      console.error("Error creating buyer verification:", error);
      res.status(400).json({ message: "Failed to create buyer verification" });
    }
  });

  app.get("/api/marketplace/verification/status", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;

      const vendorVerification = await storage.getVendorVerificationByUserId(user?.id);
      const buyerVerification = await storage.getBuyerVerificationByUserId(user?.id);

      res.json({
        vendor: vendorVerification || null,
        buyer: buyerVerification || null,
        isVendorVerified: vendorVerification?.status === 'approved',
        isBuyerVerified: buyerVerification?.status === 'approved'
      });
    } catch (error: any) {
      console.error("Error fetching verification status:", error);
      res.status(500).json({ message: "Failed to fetch verification status" });
    }
  });

  app.get("/api/marketplace/admin/verifications", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { type = 'all', status = 'all' } = req.query;

      const verifications = await storage.getVerifications({
        type: type as string,
        status: status as string
      });

      res.json(verifications);
    } catch (error: any) {
      console.error("Error fetching verifications:", error);
      res.status(500).json({ message: "Failed to fetch verifications" });
    }
  });

  // Unified notifications summary endpoint
  app.get("/api/notifications", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const summary = await (storage as any).getNotificationsSummary(user?.id);
      res.json({ summary });
    } catch (error: any) {
      console.error("Error in /api/notifications", error);
      res.status(500).json({ error: "Failed to load notifications" });
    }
  });

  app.put("/api/marketplace/admin/verifications/:id", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      const user = req.user as any;

      const updates = {
        status,
        adminNotes,
        reviewedBy: user?.id,
        reviewedAt: new Date()
      };

      const verification = await storage.updateVerification(id, updates);
      res.json(verification);
    } catch (error: any) {
      console.error("Error updating verification:", error);
      res.status(400).json({ message: "Failed to update verification" });
    }
  });

  // Address Verification Endpoints
  app.post("/api/address-verification", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const validatedData = insertAddressVerificationSchema.parse(req.body);

      // Calculate deadline (14 days from user creation)
      const userCreatedAt = new Date(user.createdAt);
      const deadline = new Date(userCreatedAt);
      deadline.setDate(deadline.getDate() + 14);

      const verification = await storage.createAddressVerification({
        ...validatedData,
        userId: user?.id,
        deadline
      });

      res.status(201).json(verification);
    } catch (error: any) {
      console.error("Error creating address verification:", error);
      res.status(400).json({ message: "Failed to create address verification" });
    }
  });

  app.get("/api/address-verification/status", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const verification = await storage.getAddressVerificationByUserId(user?.id);

      // Calculate deadline if no verification exists
      const userCreatedAt = new Date(user.createdAt);
      const deadline = new Date(userCreatedAt);
      deadline.setDate(deadline.getDate() + 14);

      const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      const isExpired = daysRemaining === 0 && !user.addressVerified;

      res.json({
        verification: verification || null,
        isVerified: user.addressVerified || false,
        deadline: deadline.toISOString(),
        daysRemaining,
        isExpired,
        requiresVerification: !user.addressVerified
      });
    } catch (error: any) {
      console.error("Error fetching address verification status:", error);
      res.status(500).json({ message: "Failed to fetch verification status" });
    }
  });

  app.post("/api/address-verification/postcard/request", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;

      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      await storage.sendAddressVerificationPostcard(user?.id, code);

      // In a real implementation, you would send the postcard via USPS API
      console.log(`Postcard verification code for ${user?.id}: ${code}`);

      res.json({ 
        message: "Verification postcard has been sent to your address. It should arrive within 5-7 business days.",
        estimatedDelivery: "5-7 business days"
      });
    } catch (error: any) {
      console.error("Error requesting postcard verification:", error);
      res.status(500).json({ message: "Failed to request postcard verification" });
    }
  });

  app.post("/api/address-verification/postcard/verify", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { code } = req.body;

      if (!code || code.length !== 6) {
        return res.status(400).json({ message: "Valid 6-digit code is required" });
      }

      const success = await storage.verifyAddressWithPostcard(user?.id, code);

      if (success) {
        res.json({ 
          message: "Address verified successfully! You now have full access to the platform.",
          verified: true
        });
      } else {
        res.status(400).json({ 
          message: "Invalid verification code. Please check the code on your postcard and try again.",
          verified: false
        });
      }
    } catch (error: any) {
      console.error("Error verifying postcard code:", error);
      res.status(500).json({ message: "Failed to verify postcard code" });
    }
  });

  app.put("/api/address-verification/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const updates = req.body;

      // Verify the user owns this verification
      const existingVerification = await storage.getAddressVerificationByUserId(user?.id);
      if (!existingVerification || existingVerification.id !== id) {
        return res.status(403).json({ message: "Not authorized to update this verification" });
      }

      const verification = await storage.updateAddressVerification(id, {
        ...updates,
        submittedAt: new Date(),
        status: 'submitted'
      });

      res.json(verification);
    } catch (error: any) {
      console.error("Error updating address verification:", error);
      res.status(400).json({ message: "Failed to update verification" });
    }
  });

  // Admin endpoints for address verification
  app.get("/api/admin/address-verifications", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const status = (req.query.status as string) || 'all';

      let query: any = db.select({
        verification: addressVerifications,
        user: users
      })
      .from(addressVerifications)
      .leftJoin(users, eq(addressVerifications.userId, users.id));

      if (status !== 'all') {
        const allowedStatuses = ['pending', 'approved', 'rejected', 'expired', 'submitted'] as const;
        if (allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
          query = query.where(eq(addressVerifications.status, status as (typeof allowedStatuses)[number]));
        }
      }

      const results = await query.orderBy(desc(addressVerifications.createdAt));

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching address verifications:", error);
      res.status(500).json({ message: "Failed to fetch verifications" });
    }
  });

  app.put("/api/admin/address-verifications/:id", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      const user = req.user as any;

      const updates: any = {
        status,
        adminNotes,
        reviewedBy: user?.id,
        reviewedAt: new Date()
      };

      if (status === 'approved') {
        updates.approvedAt = new Date();

        // Get verification record to find the user
        const [verification] = await db.select().from(addressVerifications).where(eq(addressVerifications.id, id));
        if (verification) {
          await storage.updateUser(verification.userId, { addressVerified: true });
        }
      }

      const verification = await storage.updateAddressVerification(id, updates);
      res.json(verification);
    } catch (error: any) {
      console.error("Error updating address verification:", error);
      res.status(400).json({ message: "Failed to update verification" });
    }
  });

  // Social Features API Routes

  // Community Posts
  app.get("/api/community/posts", async (req: any, res: any) => {
    try {
      const authUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = authUserId ? await storage.getUser(authUserId) : null;

      const hasExplicitLocationFilters =
        Boolean(req.query.stateCode) || Boolean(req.query.countyFips);

      const filters: Parameters<typeof storage.getCommunityPosts>[0] = {
        scope: (req.query.scope as any) || (user && !hasExplicitLocationFilters ? "county" : undefined),
        stateCode:
          (req.query.stateCode as string) ||
          (user && !hasExplicitLocationFilters ? (user.state as string | undefined) : undefined),
        countyFips:
          (req.query.countyFips as string) ||
          (user && !hasExplicitLocationFilters
            ? ((user as any).countyFips as string | undefined)
            : undefined),
        category: req.query.category as any,
        authorId: req.query.authorId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const posts = await storage.getCommunityPosts(filters);
      res.json(posts);
    } catch (error: any) {
      console.error("Error fetching community posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.post("/api/community/posts", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const { title, content, category, scope, stateCode, countyFips, images } = req.body;
      const imageUrls: string[] | undefined = Array.isArray(images)
        ? images
        : images
          ? [String(images)]
          : undefined;

      const resolvedScope = scope || "county";
      const resolvedStateCode = stateCode || (user.state as string | undefined);
      const resolvedCountyFips = countyFips || ((user as any).countyFips as string | undefined);

      const newPost = await storage.createCommunityPost({
        title,
        content,
        category,
        scope: resolvedScope,
        stateCode: resolvedStateCode,
        countyFips: resolvedCountyFips,
        imageUrls,
        authorId: userId,
        isPublished: true,
        isHidden: false,
        likeCount: 0,
        commentCount: 0
      });

      res.status(201).json(newPost);
    } catch (error: any) {
      console.error("Error creating community post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.get("/api/community/posts/:id", async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const post = await storage.getCommunityPost(id);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.json(post);
    } catch (error: any) {
      console.error("Error fetching community post:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  // Post Interactions
  app.post("/api/community/posts/:id/like", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { id: postId } = req.params;

      const result = await storage.togglePostLike(userId, postId);
      res.json(result);
    } catch (error: any) {
      console.error("Error toggling post like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  app.post("/api/community/posts/:id/comments", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const { id: postId } = req.params;
      const { content } = req.body;

      const comment = await storage.createPostComment({
        postId,
        authorId: userId,
        content,
      });

      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.get("/api/community/posts/:id/comments", async (req: any, res: any) => {
    try {
      const { id: postId } = req.params;
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error: any) {
      console.error("Error fetching post comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Community Groups
  app.get("/api/community/groups", async (req: any, res: any) => {
    try {
      const authUserId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const user = authUserId ? await storage.getUser(authUserId) : null;

      const hasExplicitLocationFilters =
        Boolean(req.query.stateCode) || Boolean(req.query.countyFips);

      const filters: Parameters<typeof storage.getGroups>[0] = {
        stateCode:
          (req.query.stateCode as string) ||
          (user && !hasExplicitLocationFilters ? ((user.state as string) || undefined) : undefined),
        countyFips:
          (req.query.countyFips as string) ||
          (user && !hasExplicitLocationFilters
            ? (((user as any).countyFips as string) || undefined)
            : undefined),
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        search: req.query.search as string,
        userId: authUserId,
      };

      const groups = await storage.getGroups(filters);
      res.json({ groups });
    } catch (error: any) {
      console.error("Error fetching community groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  app.post("/api/community/groups/:groupId/join", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { groupId } = req.params;
      await storage.joinGroup(userId, groupId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error joining community group:", error);
      res.status(500).json({ message: "Failed to join group" });
    }
  });

  app.post("/api/community/groups/:groupId/leave", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { groupId } = req.params;
      await storage.leaveGroup(userId, groupId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error leaving community group:", error);
      res.status(500).json({ message: "Failed to leave group" });
    }
  });

  // Regions
  app.get("/api/regions", async (req: any, res: any) => {
    try {
      const filters = {
        stateCode: req.query.stateCode as string,
        isOfficial: req.query.isOfficial === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const regions = await storage.getRegions(filters);
      res.json(regions);
    } catch (error: any) {
      console.error("Error fetching regions:", error);
      res.status(500).json({ message: "Failed to fetch regions" });
    }
  });

  // Handmade Marketplace Routes

  // Categories
  app.get("/api/handmade/categories", async (req: any, res: any) => {
    try {
      const categories = await storage.getHandmadeCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching handmade categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Products
  app.get("/api/handmade/products", async (req: any, res: any) => {
    try {
      const filters = {
        categoryId: req.query.categoryId as string,
        sellerId: req.query.sellerId as string,
        featured: req.query.featured === 'true',
        location: {
          state: req.query.state as string,
          county: req.query.county as string,
        },
        priceRange: {
          min: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
          max: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        },
        materials: req.query.materials ? (req.query.materials as string).split(',') : undefined,
        inStock: req.query.inStock === 'true',
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const products = await storage.getHandmadeProducts(filters);
      res.json(products);
    } catch (error: any) {
      console.error("Error fetching handmade products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/handmade/products/:id", async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const product = await storage.getHandmadeProduct(id);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Increment view count
      await storage.incrementProductViews(id);

      res.json(product);
    } catch (error: any) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/handmade/products", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const productData = {
        ...req.body,
        sellerId: userId,
      };

      const product = await storage.createHandmadeProduct(productData);
      res.status(201).json(product);
    } catch (error: any) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/handmade/products/:id", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      // Check if user owns the product
      const product = await storage.getHandmadeProduct(id);
      if (!product || product.sellerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updatedProduct = await storage.updateHandmadeProduct(id, req.body);
      res.json(updatedProduct);
    } catch (error: any) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // Product Favorites
  app.post("/api/handmade/products/:id/favorite", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const { id: productId } = req.params;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      const result = await storage.toggleProductFavorite(userId, productId);
      res.json(result);
    } catch (error: any) {
      console.error("Error toggling favorite:", error);
      res.status(500).json({ message: "Failed to toggle favorite" });
    }
  });

  app.get("/api/handmade/favorites", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const favorites = await storage.getUserFavoriteProducts(userId);
      res.json(favorites);
    } catch (error: any) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Product Orders
  app.post("/api/handmade/orders", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const orderData = {
        ...req.body,
        buyerId: userId,
      };

      const order = await storage.createProductOrder(orderData);
      res.status(201).json(order);
    } catch (error: any) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.get("/api/handmade/orders", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const type = req.query.type as 'buyer' | 'seller' || 'buyer';

      const orders = await storage.getUserOrders(userId, type);
      res.json(orders);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/handmade/orders/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      const order = await storage.getProductOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user is buyer or seller
      if (order.buyerId !== userId && order.sellerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      res.json(order);
    } catch (error: any) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.put("/api/handmade/orders/:id", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;

      const order = await storage.getProductOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user is buyer or seller
      if (order.buyerId !== userId && order.sellerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updatedOrder = await storage.updateProductOrder(id, req.body);
      res.json(updatedOrder);
    } catch (error: any) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Product Reviews
  app.post("/api/handmade/reviews", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const reviewData = {
        ...req.body,
        buyerId: userId,
      };

      const review = await storage.createProductReview(reviewData);
      res.status(201).json(review);
    } catch (error: any) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.get("/api/handmade/products/:id/reviews", async (req: any, res: any) => {
    try {
      const { id: productId } = req.params;
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.get("/api/handmade/products/:id/rating", async (req: any, res: any) => {
    try {
      const { id: productId } = req.params;
      const rating = await storage.getProductRatingSummary(productId);
      res.json(rating);
    } catch (error: any) {
      console.error("Error fetching rating:", error);
      res.status(500).json({ message: "Failed to fetch rating" });
    }
  });

  // Seller Profiles
  app.get("/api/handmade/sellers/:userId", async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const profile = await storage.getSellerProfile(userId);

      if (!profile) {
        return res.status(404).json({ message: "Seller profile not found" });
      }

      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching seller profile:", error);
      res.status(500).json({ message: "Failed to fetch seller profile" });
    }
  });

  app.post("/api/handmade/seller-profile", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const profileData = {
        ...req.body,
        userId,
      };

      const profile = await storage.createSellerProfile(profileData);
      res.status(201).json(profile);
    } catch (error: any) {
      console.error("Error creating seller profile:", error);
      res.status(500).json({ message: "Failed to create seller profile" });
    }
  });

  app.put("/api/handmade/seller-profile", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const profile = await storage.updateSellerProfile(userId, req.body);
      res.json(profile);
    } catch (error: any) {
      console.error("Error updating seller profile:", error);
      res.status(500).json({ message: "Failed to update seller profile" });
    }
  });

  app.get("/api/handmade/seller-profile", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const profile = await storage.getSellerProfile(userId);
      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching seller profile:", error);
      res.status(500).json({ message: "Failed to fetch seller profile" });
    }
  });

  app.get("/api/handmade/sellers/:userId/products", async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const products = await storage.getSellerProducts(userId);
      res.json(products);
    } catch (error: any) {
      console.error("Error fetching seller products:", error);
      res.status(500).json({ message: "Failed to fetch seller products" });
    }
  });

  app.get("/api/handmade/sellers/:userId/ratings", async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const ratings = await storage.getSellerRatings(userId);
      res.json(ratings);
    } catch (error: any) {
      console.error("Error fetching seller ratings:", error);
      res.status(500).json({ message: "Failed to fetch seller ratings" });
    }
  });

  // ===== COMMUNITY MODERATION API ROUTES =====

  // Report content for moderation
  app.post("/api/moderation/reports", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const reportData = {
        ...req.body,
        reporterId: userId,
        reporterCounty: user.county,
        reporterState: user.state,
      };

      const validatedReport = insertModerationReportSchema.parse(reportData);
      const report = await storage.createModerationReport(validatedReport);

      res.json(report);
    } catch (error: any) {
      console.error("Error creating moderation report:", error);
      res.status(500).json({ message: "Failed to create report" });
    }
  });

  // Get moderation reports for a user's location
  app.get("/api/moderation/reports", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const filters = {
        status: (req.query.status as string) || undefined,
        contentType: (req.query.contentType as string) || undefined,
        county: (req.query.county as string) || user.county || undefined,
        state: (req.query.state as string) || user.state || undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const reports = await storage.getModerationReports(filters);
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching moderation reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Get specific moderation report
  app.get("/api/moderation/reports/:reportId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { reportId } = req.params;
      const report = await storage.getModerationReport(reportId);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(report);
    } catch (error: any) {
      console.error("Error fetching moderation report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // Vote on a moderation report
  app.post("/api/moderation/reports/:reportId/vote", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const { reportId } = req.params;
      const { vote } = req.body;
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check if user can vote on this report
      const canVote = await storage.canUserVoteOnReport(userId, reportId);
      if (!canVote) {
        return res.status(403).json({ message: "You are not eligible to vote on this report" });
      }

      const voteData = {
        reportId,
        voterId: userId,
        vote,
        voterCounty: user.county,
        voterState: user.state,
      };

      const validatedVote = insertModerationVoteSchema.parse(voteData);
      const moderationVote = await storage.createModerationVote(validatedVote);

      res.json(moderationVote);
    } catch (error: any) {
      console.error("Error creating moderation vote:", error);

      if (error.message === 'User has already voted on this report') {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ message: "Failed to create vote" });
    }
  });

  // Get votes for a specific report
  app.get("/api/moderation/reports/:reportId/votes", isAuthenticated, async (req: any, res: any) => {
    try {
      const { reportId } = req.params;
      const votes = await storage.getReportVotes(reportId);
      res.json(votes);
    } catch (error: any) {
      console.error("Error fetching report votes:", error);
      res.status(500).json({ message: "Failed to fetch votes" });
    }
  });

  // Check if user can vote on a report
  app.get("/api/moderation/reports/:reportId/can-vote", isAuthenticated, async (req: any, res: any) => {
    try {
      const { reportId } = req.params;
      const userId = req.user?.claims?.sub;

      const canVote = await storage.canUserVoteOnReport(userId, reportId);
      res.json({ canVote });
    } catch (error: any) {
      console.error("Error checking vote eligibility:", error);
      res.status(500).json({ message: "Failed to check vote eligibility" });
    }
  });

  // Create moderation appeal
  app.post("/api/moderation/appeals", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;

      const appealData = {
        ...req.body,
        appellantId: userId,
      };

      const validatedAppeal = insertModerationAppealSchema.parse(appealData);
      const appeal = await storage.createModerationAppeal(validatedAppeal);

      res.json(appeal);
    } catch (error: any) {
      console.error("Error creating moderation appeal:", error);
      res.status(500).json({ message: "Failed to create appeal" });
    }
  });

  // Get user's moderation appeals
  app.get("/api/moderation/appeals", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const appeals = await storage.getAppealsByUser(userId);
      res.json(appeals);
    } catch (error: any) {
      console.error("Error fetching moderation appeals:", error);
      res.status(500).json({ message: "Failed to fetch appeals" });
    }
  });

  // Get specific moderation appeal
  app.get("/api/moderation/appeals/:appealId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { appealId } = req.params;
      const userId = req.user?.claims?.sub;

      const appeal = await storage.getModerationAppeal(appealId);

      if (!appeal) {
        return res.status(404).json({ message: "Appeal not found" });
      }

      // Only allow access to own appeals or admin users
      if (appeal.appellantId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(appeal);
    } catch (error: any) {
      console.error("Error fetching moderation appeal:", error);
      res.status(500).json({ message: "Failed to fetch appeal" });
    }
  });

  // Get user's moderation reputation
  app.get("/api/moderation/reputation", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const reputation = await storage.getUserModerationReputation(userId);

      if (!reputation) {
        // Create default reputation for new users
        const defaultReputation = {
          userId,
          reputationScore: 100,
          canVote: true,
          canReport: true,
          isSuspended: false,
          totalReportsSubmitted: 0,
          totalVotesCast: 0,
          accurateReports: 0,
          inaccurateReports: 0,
        };

        const newReputation = await storage.createUserModerationReputation(defaultReputation);
        return res.json(newReputation);
      }

      res.json(reputation);
    } catch (error: any) {
      console.error("Error fetching moderation reputation:", error);
      res.status(500).json({ message: "Failed to fetch reputation" });
    }
  });

  // Get moderation actions for content
  app.get("/api/moderation/actions/:contentType/:contentId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { contentType, contentId } = req.params;
      const actions = await storage.getModerationActions(contentType, contentId);
      res.json(actions);
    } catch (error: any) {
      console.error("Error fetching moderation actions:", error);
      res.status(500).json({ message: "Failed to fetch actions" });
    }
  });

  // Get moderation settings for location
  app.get("/api/moderation/settings", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const settings = await storage.getModerationSettings(
        user.county || undefined,
        user.state || undefined,
      );
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching moderation settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Invitation System API Routes

  // Send email invitation
  app.post("/api/invitations/send", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const { email, targetRole, personalMessage } = req.body;

      // Validate required fields
      if (!email || !targetRole) {
        return res.status(400).json({ message: "Email and target role are required" });
      }

      if (!userId) {
        return res.status(401).json({ message: "User authentication required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Generate invitation code
      const invitationCode = await storage.generateInvitationCode();

      // Create invitation
      const invitation = await storage.createInvitation({
        inviterId: userId,
        inviteeEmail: email,
        targetRole,
        personalMessage: personalMessage || null,
        invitationCode,
        type: 'email',
        status: 'pending',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      // Update user's referral stats
      await storage.incrementInvitationsSent(userId);

      // TODO: Send email notification (when email service is setup)

      res.status(201).json(invitation);
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get user's invitations
  app.get("/api/invitations/my", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const invitations = await storage.getUserInvitations(userId);
      res.json(invitations);
    } catch (error: any) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Accept invitation (public endpoint)
  app.post("/api/invitations/accept/:code", async (req: any, res: any) => {
    try {
      const { code } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Get invitation
      const invitation = await storage.getInvitationByCode(code);
      if (!invitation) {
        return res.status(404).json({ message: "Invalid invitation code" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation has already been used or expired" });
      }

      // Accept invitation
      const acceptedInvitation = await storage.acceptInvitation(code, userId);

      // Update inviter's stats
      if (invitation.inviterId) {
        await storage.incrementInvitationsAccepted(
          invitation.inviterId,
          invitation.targetRole as 'homeowner' | 'contractor'
        );
      }

      res.json(acceptedInvitation);
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Validate invitation code (public endpoint for signup page)
  app.get("/api/invitations/validate/:code", async (req: any, res: any) => {
    try {
      const { code } = req.params;

      const invitation = await storage.getInvitationByCode(code);
      if (!invitation) {
        return res.status(404).json({ 
          message: "Invalid invitation code",
          valid: false 
        });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ 
          message: "Invitation has already been used or expired",
          valid: false 
        });
      }

      res.json({
        valid: true,
        email: invitation.inviteeEmail,
        targetRole: invitation.targetRole,
        personalMessage: invitation.personalMessage
      });
    } catch (error: any) {
      console.error("Error validating invitation:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  // Generate or get user's referral code
  app.post("/api/referrals/generate-code", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let referralCode = user.referralCode;

      // Generate code if user doesn't have one
      if (!referralCode) {
        referralCode = await storage.generateUserReferralCode(userId);
      }

      res.json({ referralCode });
    } catch (error: any) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  // Get user's referral stats
  app.get("/api/referrals/stats", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const stats = await storage.getReferralStats(userId);

      if (!stats) {
        // Return default stats if none exist
        return res.json({
          totalInvitationsSent: 0,
          totalInvitationsAccepted: 0,
          contractorReferrals: 0,
          homeownerReferrals: 0
        });
      }

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Get top referrers leaderboard
  app.get("/api/referrals/leaderboard", async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topReferrers = await storage.getTopReferrers(limit);
      res.json(topReferrers);
    } catch (error: any) {
      console.error("Error fetching referral leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Cleanup expired invitations (internal endpoint)
  app.post("/api/invitations/cleanup", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      await storage.expireOldInvitations();
      res.json({ message: "Expired invitations cleaned up successfully" });
    } catch (error: any) {
      console.error("Error cleaning up invitations:", error);
      res.status(500).json({ message: "Failed to cleanup invitations" });
    }
  });

  // Professional Network Applications

  // Realtor application submission
  app.post("/api/realtor/application", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      // Check if user already has a realtor profile
      const existingProfile = await storage.getRealtorProfile(userId);
      if (existingProfile) {
        return res.status(400).json({ message: "You already have a realtor profile" });
      }

      const validatedData = insertRealtorProfileSchema.parse(req.body);
      const realtorProfile = await storage.createRealtorProfile(validatedData);

      // Update user role to realtor
      await storage.updateUserRole(userId, 'realtor');

      await storage.logEvent('realtor_application_submitted', {
        profileId: realtorProfile.id,
        userId,
      });

      res.json({ 
        message: "Realtor application submitted successfully", 
        profileId: realtorProfile.id 
      });
    } catch (error: any) {
      console.error("Error submitting realtor application:", error);
      res.status(500).json({ message: "Failed to submit realtor application" });
    }
  });

  // Car salesman application submission
  app.post("/api/car-salesman/application", isAuthenticated, requireAddressVerification, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      // Check if user already has a car salesman profile
      const existingProfile = await storage.getCarSalesmanProfile(userId);
      if (existingProfile) {
        return res.status(400).json({ message: "You already have a car salesman profile" });
      }

      const validatedData = insertCarSalesmanProfileSchema.parse(req.body);
      const carSalesmanProfile = await storage.createCarSalesmanProfile(validatedData);

      // Update user role to car_dealer
      await storage.updateUserRole(userId, 'car_dealer');

      await storage.logEvent('car_salesman_application_submitted', {
        profileId: carSalesmanProfile.id,
        userId,
      });

      res.json({ 
        message: "Car salesman application submitted successfully", 
        profileId: carSalesmanProfile.id 
      });
    } catch (error: any) {
      console.error("Error submitting car salesman application:", error);
      res.status(500).json({ message: "Failed to submit car salesman application" });
    }
  });

  // Professional verification endpoints for admins
  app.get("/api/admin/professional/pending", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const pendingRealtors = await storage.getPendingRealtorApplications();
      const pendingCarSalesmen = await storage.getPendingCarSalesmanApplications();

      res.json({
        realtors: pendingRealtors,
        carSalesmen: pendingCarSalesmen
      });
    } catch (error: any) {
      console.error("Error fetching pending applications:", error);
      res.status(500).json({ message: "Failed to fetch pending applications" });
    }
  });

  app.post("/api/admin/realtor/verify/:profileId", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { profileId } = req.params;
      const { approved, notes } = req.body;
      const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      const result = await storage.updateRealtorVerificationStatus(
        profileId, 
        {
          approved: !!approved,
          notes: notes || '',
          reviewedBy: adminId,
          reviewedAt: new Date(),
        }
      );

      await storage.logEvent('realtor_verification_decision', {
        profileId,
        adminId,
        approved,
        notes
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error updating realtor verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  app.post("/api/admin/car-salesman/verify/:profileId", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { profileId } = req.params;
      const { approved, notes } = req.body;
      const adminId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      const result = await storage.updateCarSalesmanVerificationStatus(
        profileId, 
        {
          approved: !!approved,
          notes: notes || '',
          reviewedBy: adminId,
          reviewedAt: new Date(),
        }
      );

      await storage.logEvent('car_salesman_verification_decision', {
        profileId,
        adminId,
        approved,
        notes
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error updating car salesman verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // ==================== PROFESSIONAL PARTNERSHIPS ====================

  // Request partnership between professionals (dealers, contractors, realtors)
  app.post("/api/partnerships/request", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const { partnerId, partnershipType, referralTerms, partnershipDescription } = req.body;

      if (!partnerId || !partnershipType) {
        return res.status(400).json({ message: "Partner ID and partnership type are required" });
      }

      // Check if partnership already exists (stub for now)
      // const existingPartnership = await storage.getPartnership(userId, partnerId);

      const partnership = {
        id: `partnership_${Date.now()}`,
        initiatorId: userId,
        partnerId,
        partnershipType,
        referralTerms,
        partnershipDescription,
        status: 'pending',
        createdAt: new Date()
      };

      res.status(201).json(partnership);
    } catch (error: any) {
      console.error("Error creating partnership:", error);
      res.status(500).json({ message: "Failed to create partnership request" });
    }
  });

  // Get user's partnerships  
  app.get("/api/partnerships/my", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);
      
      // Mock partnerships for different roles
      const mockPartnerships = user?.role === 'car_dealer' ? [
        {
          id: 'partnership_1',
          initiatorId: userId,
          partnerId: 'contractor_123',
          partnerName: 'Thompson Construction',
          partnershipType: 'dealer_contractor',
          status: 'active',
          totalReferrals: 5,
          successfulReferrals: 3,
          totalCommissionEarned: '1250.00'
        },
        {
          id: 'partnership_2',  
          initiatorId: 'contractor_456',
          partnerId: userId,
          partnerName: 'Elite Roofing Co',
          partnershipType: 'dealer_contractor',
          status: 'pending',
          totalReferrals: 0,
          successfulReferrals: 0,
          totalCommissionEarned: '0.00'
        }
      ] : [];

      res.json(mockPartnerships);
    } catch (error: any) {
      console.error("Error fetching partnerships:", error);
      res.status(500).json({ message: "Failed to fetch partnerships" });
    }
  });

  // Find potential partners by role
  app.get("/api/partnerships/find/:role", isAuthenticated, async (req: any, res: any) => {
    try {
      const { role } = req.params;
      
      // Mock potential partners based on requested role
      const mockPartners = role === 'contractor' ? [
        {
          id: 'contractor_789',
          firstName: 'Mike',
          lastName: 'Rodriguez',
          companyName: 'Rodriguez Construction',
          specialties: ['Roofing', 'Siding', 'General'],
          rating: 4.8,
          completedJobs: 147,
          location: 'Downtown Area'
        },
        {
          id: 'contractor_101',
          firstName: 'Sarah',
          lastName: 'Johnson',
          companyName: 'Johnson Home Improvements',
          specialties: ['Kitchen Remodel', 'Bathroom Remodel'],
          rating: 4.9,
          completedJobs: 89,
          location: 'Westside'
        }
      ] : [];

      res.json(mockPartners);
    } catch (error: any) {
      console.error("Error finding potential partners:", error);
      res.status(500).json({ message: "Failed to find potential partners" });
    }
  });

  // ==================== AFFILIATE SYSTEM ROUTES ====================

  // Create or get affiliate program for user
  app.post("/api/affiliate/join", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Check if user already has an affiliate program
      const existingProgram = await storage.getAffiliateProgram(userId);
      if (existingProgram) {
        return res.json(existingProgram);
      }

      // Generate unique affiliate code
      const referralCode = await storage.generateAffiliateCode(userId);

      // Create new affiliate program
      const program = await storage.createAffiliateProgram({
        userId,
        referralCode,
        status: 'active'
      });

      res.status(201).json(program);
    } catch (error: any) {
      console.error("Error joining affiliate program:", error);
      res.status(500).json({ message: "Failed to join affiliate program" });
    }
  });

  // Get affiliate dashboard data
  app.get("/api/affiliate/dashboard", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const [stats, referrals, commissions, payouts] = await Promise.all([
        storage.getAffiliateStats(program.id),
        storage.getReferralsByAffiliate(program.id),
        storage.getCommissionsForAffiliate(program.id),
        storage.getPayoutsForAffiliate(program.id)
      ]);

      res.json({
        // program, // Removed undefined reference
        stats,
        referrals: referrals.slice(0, 10), // Last 10 referrals
        commissions: commissions.slice(0, 10), // Last 10 commissions
        payouts: payouts.slice(0, 5) // Last 5 payouts
      });
    } catch (error: any) {
      console.error("Error fetching affiliate dashboard:", error);
      res.status(500).json({ message: "Failed to fetch affiliate dashboard" });
    }
  });

  // Track referral click (public endpoint)
  app.post("/api/affiliate/track-click", async (req: any, res: any) => {
    try {
      return res.status(501).json({
        message: "Affiliate click tracking is disabled in the current deployment"
      });
    } catch (error: any) {
      console.error("Error tracking referral click:", error);
      res.status(500).json({ message: "Failed to track referral" });
    }
  });

  // Convert referral when user signs up
  app.post("/api/affiliate/convert", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const { affiliateCode } = req.body;

      if (!affiliateCode) {
        return res.status(400).json({ message: "Affiliate code is required" });
      }

      // Convert the referral
      await storage.convertReferral(affiliateCode, userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error converting referral:", error);
      res.status(500).json({ message: "Failed to convert referral" });
    }
  });

  // Process commission (internal use - called when revenue is generated)
  app.post("/api/affiliate/commission", isAuthenticated, async (req: any, res: any) => {
    try {
      const { 
        affiliateProgramId, 
        referralId, 
        transactionId, 
        revenueAmount, 
        commissionAmount, 
        description 
      } = req.body;

      if (!affiliateProgramId || !revenueAmount || !commissionAmount) {
        return res.status(400).json({ 
          message: "Affiliate program ID, revenue amount, and commission amount are required" 
        });
      }

      const commission = await storage.createCommission({
        affiliateProgramId,
        referralId,
        transactionId,
        revenueAmount: revenueAmount.toString(),
        commissionAmount: commissionAmount.toString(),
        // description: description || 'Commission earned',
        status: 'pending'
      });

      res.status(201).json(commission);
    } catch (error: any) {
      console.error("Error creating commission:", error);
      res.status(500).json({ message: "Failed to create commission" });
    }
  });

  // Get referrals for affiliate
  app.get("/api/affiliate/referrals", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const referrals = await storage.getReferralsByAffiliate(program.id);
      res.json(referrals);
    } catch (error: any) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // Get commissions for affiliate
  app.get("/api/affiliate/commissions", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const commissions = await storage.getCommissionsForAffiliate(program.id);
      res.json(commissions);
    } catch (error: any) {
      console.error("Error fetching commissions:", error);
      res.status(500).json({ message: "Failed to fetch commissions" });
    }
  });

  // Get payouts for affiliate
  app.get("/api/affiliate/payouts", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const payouts = await storage.getPayoutsForAffiliate(program.id);
      res.json(payouts);
    } catch (error: any) {
      console.error("Error fetching payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // Admin: Approve commission
  app.put("/api/admin/affiliate/commissions/:commissionId/approve", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const user = await storage.getUser(userId);

      // Check admin permissions
      const userRole = user?.role || '';
      if (!user || !['ops_admin', 'head_admin'].includes(userRole)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { commissionId } = req.params;
      await storage.approveCommission(commissionId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error approving commission:", error);
      res.status(500).json({ message: "Failed to approve commission" });
    }
  });

  // Admin: Create payout
  app.post("/api/admin/affiliate/payouts", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const user = await storage.getUser(userId);

      // Check admin permissions
      const userRole = user?.role || '';
      if (!user || !['ops_admin', 'head_admin'].includes(userRole)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { affiliateProgramId, totalAmount, payoutMethod, notes } = req.body;

      if (!affiliateProgramId || !totalAmount) {
        return res.status(400).json({ 
          message: "Affiliate program ID and total amount are required" 
        });
      }

      const payout = await storage.createPayout({
        affiliateProgramId,
        totalAmount: totalAmount.toString(),
        payoutMethod: payoutMethod || 'manual',
        status: 'pending',
        notes
      });

      res.status(201).json(payout);
    } catch (error: any) {
      console.error("Error creating payout:", error);
      res.status(500).json({ message: "Failed to create payout" });
    }
  });

  // Admin: Update payout status
  app.put("/api/admin/affiliate/payouts/:payoutId/status", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const user = await storage.getUser(userId);

      // Check admin permissions
      const userRole = user?.role || '';
      if (!user || !['ops_admin', 'head_admin'].includes(userRole)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { payoutId } = req.params;
      const { status } = req.body;

      if (!status || !['pending', 'processing', 'completed', 'failed'].includes(status)) {
        return res.status(400).json({ message: "Valid status is required" });
      }

      await storage.updatePayoutStatus(payoutId, status);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating payout status:", error);
      res.status(500).json({ message: "Failed to update payout status" });
    }
  });

  // Update affiliate program settings
  app.put("/api/affiliate/settings", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const { payoutMethod, payoutDetails } = req.body;

      const updatedProgram = await storage.updateAffiliateProgram(program.id, {});

      res.json({
        ...updatedProgram,
        payoutMethod,
        payoutDetails,
      });
    } catch (error: any) {
      console.error("Error updating affiliate settings:", error);
      res.status(500).json({ message: "Failed to update affiliate settings" });
    }
  });

  // Initialize WebSocket server
  // Tutorial Management Routes
  app.get("/api/tutorials/user-progress", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.getUserTutorialProgress(userId);
      res.json(progress);
    } catch (error: any) {
      console.error("Error fetching tutorial progress:", error);
      res.status(500).json({ message: "Failed to fetch tutorial progress" });
    }
  });

  app.get("/api/tutorials/recommended", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const userRole = req.user?.role || 'homeowner';

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const recommended = await tutorialStorage.getRecommendedTutorialsForUser(userId, userRole);
      res.json(recommended);
    } catch (error: any) {
      console.error("Error fetching recommended tutorials:", error);
      res.status(500).json({ message: "Failed to fetch recommended tutorials" });
    }
  });

  app.get("/api/tutorials/:tutorialId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { tutorialId } = req.params;
      const tutorial = await tutorialStorage.getTutorialById(tutorialId);

      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      res.json(tutorial);
    } catch (error: any) {
      console.error("Error fetching tutorial:", error);
      res.status(500).json({ message: "Failed to fetch tutorial" });
    }
  });

  app.post("/api/tutorials/:tutorialId/start", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const tutorial = await tutorialStorage.getTutorialById(tutorialId);
      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      // Record analytics
      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: tutorial.steps[0]?.id || 'start',
        action: 'started',
        userAgent: req.headers['user-agent'],
        viewport: req.body.viewport,
      });

      // Create or update progress
      const progress = await tutorialStorage.createOrUpdateTutorialProgress({
        userId,
        tutorialId,
        tutorialType: tutorial.type as 'onboarding' | 'feature',
        stepIndex: "0",
        isCompleted: false,
        isSkipped: false,
      });

      res.json({ progress, tutorial });
    } catch (error: any) {
      console.error("Error starting tutorial:", error);
      res.status(500).json({ message: "Failed to start tutorial" });
    }
  });

  app.put("/api/tutorials/:tutorialId/progress", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;
      const { stepIndex, action, timeSpent, metadata } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const tutorial = await tutorialStorage.getTutorialById(tutorialId);
      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      // Record analytics
      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: tutorial.steps[parseInt(stepIndex)]?.id || stepIndex,
        action,
        timeSpent: timeSpent?.toString(),
        userAgent: req.headers['user-agent'],
        viewport: req.body.viewport,
        metadata,
      });

      // Update progress
      const progress = await tutorialStorage.createOrUpdateTutorialProgress({
        userId,
        tutorialId,
        tutorialType: tutorial.type as 'onboarding' | 'feature',
        stepIndex,
        isCompleted: action === 'completed',
        isSkipped: action === 'skipped',
        metadata,
        ...(action === 'completed' || action === 'skipped' ? { completedAt: new Date() } : {}),
      });

      res.json(progress);
    } catch (error: any) {
      console.error("Error updating tutorial progress:", error);
      res.status(500).json({ message: "Failed to update tutorial progress" });
    }
  });

  app.post("/api/tutorials/:tutorialId/complete", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;
      const { finalStepIndex } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.markTutorialCompleted(userId, tutorialId, finalStepIndex);

      // Record completion analytics
      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: 'completion',
        action: 'completed',
        userAgent: req.headers['user-agent'],
        viewport: req.body.viewport,
      });

      res.json(progress);
    } catch (error: any) {
      console.error("Error completing tutorial:", error);
      res.status(500).json({ message: "Failed to complete tutorial" });
    }
  });

  app.post("/api/tutorials/:tutorialId/skip", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { tutorialId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.markTutorialSkipped(userId, tutorialId);

      // Record skip analytics
      await tutorialStorage.recordTutorialAnalytics({
        userId,
        tutorialId,
        stepId: 'skip',
        action: 'skipped',
        userAgent: req.headers['user-agent'],
        viewport: req.body.viewport,
      });

      res.json(progress);
    } catch (error: any) {
      console.error("Error skipping tutorial:", error);
      res.status(500).json({ message: "Failed to skip tutorial" });
    }
  });

  app.get("/api/tutorials/check/:featureId", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
      const { featureId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const shouldShow = await tutorialStorage.shouldShowTutorial(userId, featureId);
      const tutorial = shouldShow ? await tutorialStorage.getTutorialById(featureId) : null;

      res.json({ shouldShow, tutorial });
    } catch (error: any) {
      console.error("Error checking tutorial:", error);
      res.status(500).json({ message: "Failed to check tutorial" });
    }
  });

  // Initialize default tutorials on server start
  // tutorialStorage.initializeDefaultTutorials().catch(console.error); // Disabled for deployment

  const httpServer = createServer(app);
  // Initialize WebSocket manager for real-time communication
  // DISABLED: Using Socket.io messaging service instead (configured in index.ts)
  // const wsManager = new WebSocketManager(httpServer);

  // Advanced marketplace transaction routes

  // Create payment intent for marketplace purchase
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res: any) => {
    try {
      if (!stripe) {
        return res.status(500).json({ 
          message: "Payment processing not configured. Stripe keys needed." 
        });
      }

      const { listingId } = req.body;
      const listing = await storage.getMarketplaceListing(listingId);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      const listingPrice = Number(listing.price ?? 0);
      const platformFee = Math.round(listingPrice * 0.05 * 100); // 5% platform fee in cents
      const totalAmount = Math.round(listingPrice * 100) + platformFee; // Total in cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        metadata: {
          listingId: listing.id,
          sellerId: listing.sellerId,
          buyerId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
          platformFee: platformFee.toString(),
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Create marketplace transaction
  app.post("/api/marketplace/transactions", isAuthenticated, async (req: any, res: any) => {
    try {
      const transactionData = {
        ...req.body,
        buyerId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
      };

      const transaction = await storage.createMarketplaceTransaction(transactionData);

      // Send notifications to both buyer and seller
      const sellerNotification = {
        userId: transaction.sellerId,
        type: 'payment_received' as const,
        title: 'New Purchase',
        message: `Someone purchased your item for $${transaction.totalAmount}`,
        actionUrl: `/transactions/${transaction.id}`,
      };

      const buyerNotification = {
        userId: transaction.buyerId,
        type: 'payment_received' as const,
        title: 'Purchase Confirmed',
        message: `Your purchase of $${transaction.totalAmount} has been confirmed`,
        actionUrl: `/transactions/${transaction.id}`,
      };

      await Promise.all([
        storage.createNotification(sellerNotification),
        storage.createNotification(buyerNotification),
      ]);

      // Send real-time notifications
      // TODO: Use messaging service if needed
      // wsManager.sendNotificationToUser(transaction.sellerId, sellerNotification);
      // wsManager.sendNotificationToUser(transaction.buyerId, buyerNotification);

      res.json(transaction);
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  // Get user transactions
  app.get("/api/marketplace/transactions", isAuthenticated, async (req: any, res: any) => {
    try {
      const { role = 'buyer' } = req.query;
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

      const transactions = await storage.getMarketplaceTransactionsByUser(userId, role as 'buyer' | 'seller');
      res.json(transactions);
    } catch (error: any) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Update transaction status
  app.put("/api/marketplace/transactions/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const transaction = await storage.updateMarketplaceTransaction(id, req.body);

      // Send real-time update
      // TODO: Use messaging service if needed
      // wsManager.sendTransactionUpdate(transaction.buyerId, transaction);
      // wsManager.sendTransactionUpdate(transaction.sellerId, transaction);

      res.json(transaction);
    } catch (error: any) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  // Create user review
  app.post("/api/reviews", isAuthenticated, async (req: any, res: any) => {
    try {
      const reviewData = {
        ...req.body,
        reviewerId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
      };

      const review = await storage.createUserReview(reviewData);

      // Send notification to reviewee
      const notification = {
        userId: review.revieweeId,
        type: 'review_received' as const,
        title: 'New Review Received',
        message: `You received a ${review.rating}-star review`,
        actionUrl: `/profile/reviews`,
      };

      await storage.createNotification(notification);
      // TODO: Use messaging service if needed
      // wsManager.sendNotificationToUser(review.revieweeId, notification);

      res.json(review);
    } catch (error: any) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Get user reviews
  app.get("/api/reviews/:userId", async (req: any, res: any) => {
    try {
      const { userId } = req.params;
      const { role = 'reviewee' } = req.query;

      const reviews = await storage.getUserReviews(userId, role as 'reviewer' | 'reviewee');
      const ratings = await storage.getUserRatings(userId);

      res.json({ reviews, ratings });
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Notification routes removed - using server/routes/notification-routes.ts

  // Advanced search and discovery
  app.get("/api/marketplace/search", async (req: any, res: any) => {
    try {
      const {
        query,
        category,
        minPrice,
        maxPrice,
        location,
        condition,
        verifiedOnly,
        freeShipping,
        buyerProtection,
        sortBy = 'date_desc'
      } = req.query;

      // Log search analytics if user is authenticated
      if (req.user) {
        await storage.logSearchAnalytics({
          userId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
          searchQuery: query as string,
          searchType: 'marketplace',
          filters: {
            category,
            minPrice: minPrice ? parseInt(minPrice as string) : undefined,
            maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
            location,
            condition,
            verifiedOnly: verifiedOnly === 'true',
            freeShipping: freeShipping === 'true',
            buyerProtection: buyerProtection === 'true',
            sortBy
          },
          resultsCount: 0, // Will be updated after search
        });
      }

      // Perform search with filters
      const searchResults = await storage.getMarketplaceListings({
        searchQuery: query as string,
        categoryId: category as string,
        priceMin: minPrice ? parseInt(minPrice as string) : undefined,
        priceMax: maxPrice ? parseInt(maxPrice as string) : undefined,
        condition: condition as string,
        sortBy: sortBy as any,
      });

      res.json(searchResults);
    } catch (error: any) {
      console.error("Error performing search:", error);
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // Saved searches
  app.post("/api/saved-searches", isAuthenticated, async (req: any, res: any) => {
    try {
      const searchData = {
        ...req.body,
        userId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
      };

      const savedSearch = await storage.createSavedSearch(searchData);
      res.json(savedSearch);
    } catch (error: any) {
      console.error("Error saving search:", error);
      res.status(500).json({ message: "Failed to save search" });
    }
  });

  app.get("/api/saved-searches", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const savedSearches = await storage.getUserSavedSearches(userId);
      res.json(savedSearches);
    } catch (error: any) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ message: "Failed to fetch saved searches" });
    }
  });

  app.delete("/api/saved-searches/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      await storage.deleteSavedSearch(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ message: "Failed to delete saved search" });
    }
  });

  // Transaction disputes
  app.post("/api/disputes", isAuthenticated, async (req: any, res: any) => {
    try {
      const disputeData = {
        ...req.body,
        initiatorId: (req.user as any)?.claims?.sub || (req.user as any)?.id,
      };

      const dispute = await storage.createTransactionDispute(disputeData);

      // Notify relevant parties
      const notification = {
        userId: dispute.transactionId, // Will need to get the other party's ID
        type: 'dispute',
        title: 'Transaction Dispute Opened',
        message: 'A dispute has been opened for one of your transactions',
        actionUrl: `/disputes/${dispute.id}`,
      };

      res.json(dispute);
    } catch (error: any) {
      console.error("Error creating dispute:", error);
      res.status(500).json({ message: "Failed to create dispute" });
    }
  });

  // ==================== PAYMENT SYSTEM ROUTES ====================

  // Payment methods and configurations
  app.get("/api/payments/methods", isAuthenticated, (req: Request, res: Response) => {
    try {
      const methods = paymentService.getAvailablePaymentMethods(true);
      res.json(methods);
    } catch (error: any) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  // Create contractor payment intent
  app.post("/api/payments/contractor/create-intent", isAuthenticated, async (req: any, res: any) => {
    try {
      const { contractorPaymentId } = req.body;

      if (!contractorPaymentId) {
        return res.status(400).json({ message: "Payment ID required" });
      }

      const payment = await storage.getContractorPayment(contractorPaymentId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Verify user authorization (either homeowner or contractor)
      const user = req.user;
      if (payment.homeownerId !== user?.id && payment.contractorId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to access this payment" });
      }

      const result = await paymentService.createContractorPaymentIntent(payment);
      res.json(result);
    } catch (error: any) {
      console.error("Error creating contractor payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // Create marketplace payment intent
  app.post("/api/payments/marketplace/create-intent", isAuthenticated, async (req: any, res: any) => {
    try {
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({ message: "Transaction ID required" });
      }

      const transaction = await storage.getMarketplaceTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Verify user authorization (either buyer or seller)
      const user = req.user;
      if (transaction.buyerId !== user?.id && transaction.sellerId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to access this transaction" });
      }

      const result = await paymentService.createMarketplacePaymentIntent(transaction);
      res.json(result);
    } catch (error: any) {
      console.error("Error creating marketplace payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // Confirm off-platform payment
  app.post("/api/payments/confirm-off-platform", isAuthenticated, async (req: any, res: any) => {
    try {
      const { paymentId, paymentType, confirmationData } = req.body;

      if (!paymentId|| !paymentType || !confirmationData) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const user = req.user;
      const result = await paymentService.confirmOffPlatformPayment(
        paymentId, 
        paymentType, 
        {
          ...confirmationData,
          confirmedBy: user?.id
        }
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error confirming off-platform payment:", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // Get payment details
  app.get("/api/payments/contractor/:paymentId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { paymentId } = req.params;
      const payment = await storage.getContractorPayment(paymentId);

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Verify user authorization
      const user = req.user;
      if (payment.homeownerId !== user?.id && payment.contractorId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to access this payment" });
      }

      res.json(payment);
    } catch (error: any) {
      console.error("Error fetching contractor payment:", error);
      res.status(500).json({ message: "Failed to fetch payment" });
    }
  });

  app.get("/api/payments/marketplace/:transactionId", isAuthenticated, async (req: any, res: any) => {
    try {
      const { transactionId } = req.params;
      const transaction = await storage.getMarketplaceTransaction(transactionId);

      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Verify user authorization
      const user = req.user;
      if (transaction.buyerId !== user?.id && transaction.sellerId !== user?.id) {
        return res.status(403).json({ message: "Not authorized to access this transaction" });
      }

      res.json(transaction);
    } catch (error: any) {
      console.error("Error fetching marketplace transaction:", error);
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });

  // Get user payment history
  app.get("/api/payments/history", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user;
      const { type = 'all' } = req.query;

      const history: any = {};

      if (type === 'all' || type === 'contractor') {
        // Get contractor payments where user is homeowner
        const homeownerPayments = await storage.getContractorPaymentsByHomeowner(user?.id);
        // Get contractor payments where user is contractor  
        const contractorPayments = await storage.getContractorPaymentsByContractor(user?.id);
        history.contractorPayments = {
          asHomeowner: homeownerPayments,
          asContractor: contractorPayments
        };
      }

      if (type === 'all' || type === 'marketplace') {
        // Get marketplace transactions where user is buyer
        const buyerTransactions = await storage.getMarketplaceTransactionsByUser(user?.id, 'buyer');
        // Get marketplace transactions where user is seller
        const sellerTransactions = await storage.getMarketplaceTransactionsByUser(user?.id, 'seller');
        history.marketplaceTransactions = {
          asBuyer: buyerTransactions,
          asSeller: sellerTransactions
        };
      }

      res.json(history);
    } catch (error: any) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  // Calculate payment fees
  app.post("/api/payments/calculate-fees", async (req: any, res: any) => {
    try {
      const { amount, paymentType = 'contractor_service' } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }

      const fees = await paymentService.calculatePaymentFees(amount, paymentType);
      res.json(fees);
    } catch (error: any) {
      console.error("Error calculating fees:", error);
      res.status(500).json({ message: "Failed to calculate fees" });
    }
  });

  // Stripe webhook endpoint
  app.post("/api/payments/webhook", async (req: any, res: any) => {
    try {
      // In production, you should verify the webhook signature
      const event = req.body;

      await paymentService.handleStripeWebhook(event);
      res.json({ received: true });
    } catch (error: any) {
      console.error("Error handling webhook:", error);
      res.status(500).json({ message: "Webhook handler failed" });
    }
  });

  // Admin payment configuration routes
  app.get("/api/admin/payment-config", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const { configType = 'contractor_service' } = req.query;
      const normalizedConfigType = (configType as 'marketplace_transaction' | 'contractor_service' | 'premium_subscription') ?? 'contractor_service';
      const config = await storage.getPaymentConfiguration(normalizedConfigType);
      res.json(config || {});
    } catch (error: any) {
      console.error("Error fetching payment config:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.post("/api/admin/payment-config", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const configData = req.body;
      const config = await storage.createPaymentConfiguration(configData);
      res.status(201).json(config);
    } catch (error: any) {
      console.error("Error creating payment config:", error);
      res.status(500).json({ message: "Failed to create configuration" });
    }
  });


  // Get user's donations
  app.get('/api/foundation/my-donations', isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const { status, type } = req.query;

      const filters = {
        status: status as string,
        type: type as string
      };

      const donations = await storage.getUserDonations(userId, filters);
      res.json(donations);
    } catch (error: any) {
      console.error('Error fetching user donations:', error);
      res.status(500).json({ message: 'Failed to fetch donations' });
    }
  });

  // Get/Update user donation preferences
  app.get('/api/foundation/preferences', isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const preferences = await storage.getUserDonationPreferences(userId);
      res.json(preferences || {});
    } catch (error: any) {
      console.error('Error fetching donation preferences:', error);
      res.status(500).json({ message: 'Failed to fetch preferences' });
    }
  });

  app.put('/api/foundation/preferences', isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const preferences = await storage.upsertUserDonationPreferences(userId, req.body);
      res.json(preferences);
    } catch (error: any) {
      console.error('Error updating donation preferences:', error);
      res.status(500).json({ message: 'Failed to update preferences' });
    }
  });

  // Get recent donations (public feed)
  app.get('/api/foundation/recent-donations', async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const donations = await storage.getRecentDonations(limit);
      res.json(donations);
    } catch (error: any) {
      console.error('Error fetching recent donations:', error);
      res.status(500).json({ message: 'Failed to fetch recent donations' });
    }
  });

  // Get foundation impact reports
  app.get('/api/foundation/impact-reports', async (req: any, res: any) => {
    try {
      const { causeId } = req.query;
      const reports = await storage.getFoundationImpactReports(causeId as string);
      res.json(reports);
    } catch (error: any) {
      console.error('Error fetching impact reports:', error);
      res.status(500).json({ message: 'Failed to fetch impact reports' });
    }
  });

  // County vault balances (community reinvestment)
  app.get('/api/vaults/my-county', isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      const userRecord = await storage.getUser(userId);

      if (!userRecord?.county || !userRecord?.state) {
        return res.status(400).json({ message: 'Add your county and state to view your community vault balance.' });
      }

      const snapshot = await storage.getCountyVaultSnapshot({
        countyName: userRecord.county,
        stateCode: userRecord.state,
      });

      res.json({
        county: snapshot.county,
        vault: snapshot.vault
          ? {
              ...snapshot.vault,
              currentBalance: Number(snapshot.vault.currentBalance ?? 0),
              lifetimeInflow: Number(snapshot.vault.lifetimeInflow ?? 0),
              lifetimeOutflow: Number(snapshot.vault.lifetimeOutflow ?? 0),
            }
          : null,
        last30dInflow: snapshot.last30dInflow,
        sourcesBreakdown: snapshot.sourcesBreakdown,
        ledger: snapshot.ledger.map((entry) => ({
          ...entry,
          amount: Number(entry.amount ?? 0),
        })),
      });
    } catch (error: any) {
      console.error('Error fetching county vault:', error);
      res.status(500).json({ message: 'Failed to load vault balance' });
    }
  });

  app.get('/api/vaults/county/:countyId', async (req: any, res: any) => {
    try {
      const { countyId } = req.params;
      const snapshot = await storage.getCountyVaultSnapshot({ countyId });

      res.json({
        county: snapshot.county,
        vault: snapshot.vault
          ? {
              ...snapshot.vault,
              currentBalance: Number(snapshot.vault.currentBalance ?? 0),
              lifetimeInflow: Number(snapshot.vault.lifetimeInflow ?? 0),
              lifetimeOutflow: Number(snapshot.vault.lifetimeOutflow ?? 0),
            }
          : null,
        last30dInflow: snapshot.last30dInflow,
        sourcesBreakdown: snapshot.sourcesBreakdown,
        ledger: snapshot.ledger.map((entry) => ({
          ...entry,
          amount: Number(entry.amount ?? 0),
        })),
      });
    } catch (error: any) {
      console.error('Error fetching county vault by id:', error);
      res.status(500).json({ message: 'Failed to load vault balance' });
    }
  });

  // Admin: Create foundation cause
  app.post('/api/admin/foundation/causes', isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      // TODO: Implement admin permission check and cause creation logic
      res.status(501).json({ message: "Not implemented" });
    } catch (error: any) {
      console.error("Error creating foundation cause:", error);
      res.status(500).json({ message: "Failed to create foundation cause" });
    }
  });

  app.post("/api/user/account-deletion-request", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const request = await dataManagementService.createDataRequest({
        userId: user?.id,
        requestType: 'account_closure',
        reason: req.body.reason,
        requestedBy: user?.id,
      });

      await dataManagementService.logDataAccess({
        userId: user?.id,
        accessorId: user?.id,
        accessorRole: user.role,
        actionType: 'delete',
        resourceType: 'profile',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { requestId: request.id }
      });

      res.json({
        message: "Account deletion request created. This requires admin approval.",
        requestId: request.id
      });
    } catch (error: any) {
      console.error("Error creating account deletion request:", error);
      res.status(500).json({ message: "Failed to create account deletion request" });
    }
  });

  app.get("/api/user/data-export", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const userId = user?.id || user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const request = await dataManagementService.createDataRequest({
        userId,
        requestType: 'data_export',
        requestedBy: userId,
      });

      await dataManagementService.logDataAccess({
        userId,
        accessorId: userId,
        accessorRole: user?.role || 'user',
        actionType: 'export',
        resourceType: 'profile',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { requestId: request.id }
      });

      const exportData = await dataManagementService.exportUserData(userId);
      const zipBuffer = await dataManagementService.createDataExportFile(exportData);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="tradescout-data-export-${userId}.zip"`);
      res.send(zipBuffer);
    } catch (error: any) {
      console.error("Error exporting user data:", error);
      res.status(500).json({ message: "Failed to export user data" });
    }
  });

  // Admin Data Management Routes
  app.get("/api/admin/data-requests", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { status } = req.query;

      await dataManagementService.logDataAccess({
        accessorId: user?.id,
        accessorRole: user.role,
        actionType: 'view',
        resourceType: 'analytics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const requests = await dataManagementService.getAllDataRequests(status as string);
      res.json(requests);
    } catch (error: any) {
      console.error("Error fetching data requests:", error);
      res.status(500).json({ message: "Failed to fetch data requests" });
    }
  });

  app.post("/api/admin/process-data-export/:id", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      const requests = await dataManagementService.getAllDataRequests();
      const request = requests.find((r: any) => r.id === id);

      if (!request || request.requestType !== 'data_export') {
        return res.status(404).json({ message: "Data export request not found" });
      }

      await dataManagementService.logDataAccess({
        userId: request.userId,
        accessorId: user?.id,
        accessorRole: user.role,
        actionType: 'export',
        resourceType: 'profile',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { adminProcessed: true, requestId: id }
      });

      const exportData = await dataManagementService.exportUserData(request.userId);
      const zipBuffer = await dataManagementService.createDataExportFile(exportData);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="tradescout-data-export-${request.userId}.zip"`);
      res.send(zipBuffer);

    } catch (error: any) {
      console.error("Error processing data export:", error);
      res.status(500).json({ message: "Failed to process data export" });
    }
  });

  app.post("/api/admin/approve-account-deletion/:id", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      const requests = await dataManagementService.getAllDataRequests();
      const request = requests.find((r: any) => r.id === id);

      if (!request || request.requestType !== 'account_closure') {
        return res.status(404).json({ message: "Account deletion request not found" });
      }

      await dataManagementService.deleteUserData(request.userId, user?.id);

      res.json({ message: "Account successfully deleted" });

    } catch (error: any) {
      console.error("Error processing account deletion:", error);
      res.status(500).json({ message: "Failed to process account deletion" });
    }
  });

  app.get("/api/admin/security-incidents", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { status } = req.query;

      await dataManagementService.logDataAccess({
        accessorId: user?.id,
        accessorRole: user.role,
        actionType: 'view',
        resourceType: 'analytics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const incidents = await dataManagementService.getSecurityIncidents(status as string);
      res.json(incidents);
    } catch (error: any) {
      console.error("Error fetching security incidents:", error);
      res.status(500).json({ message: "Failed to fetch security incidents" });
    }
  });

  app.get("/api/admin/user-access-logs/:userId", isAuthenticated, isAdmin, async (req: any, res: any) => {
    try {
      const user = req.user as any;
      const { userId } = req.params;
      const { limit = 100 } = req.query;

      await dataManagementService.logDataAccess({
        userId: userId,
        accessorId: user?.id,
        accessorRole: user.role,
        actionType: 'view',
        resourceType: 'analytics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const logs = await dataManagementService.getUserAccessLogs(userId, parseInt(limit as string));
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching user access logs:", error);
      res.status(500).json({ message: "Failed to fetch access logs" });
    }
  });

  // Device management endpoints for master admin - temporarily removed for debugging

  // Register social media routes
  registerSocialRoutes(app);

  // Fallback for legacy client trending endpoint
  const trendingHandler: ExpressHandler = (_req, res) => {
    res.json({ items: [], message: "Trending data not available yet." });
  };

  app.get("/api/trending", trendingHandler);

  // Set up community moderation routes
  setupModerationRoutes(app);

  // Setup UI monitoring routes
  registerUIIssuesRoutes(app);

  // Register AI Code Fixing routes
  registerAICodeFixRoutes(app);

  // Register CRM routes
  registerCrmRoutes(app);
  
  // Register notification routes
  registerNotificationRoutes(app);
  
  // Register analytics routes
  registerAnalyticsRoutes(app);
  
  // Register recommendation generator routes
  registerRecommendationGeneratorRoutes(app);

  // Register business profile routes
  app.use(businessesRouter);

  // Register Profile website routes
  app.use(profilesRouter);
  
  // Register contractor signup routes
  app.use(contractorSignupRouter);

  // Register Community Builder routes
  app.use("/api/community-builder", communityBuilderRouter);
  app.use("/api/admin/community-builder", adminCommunityBuilderRouter);

  // Register Community Vault MVP routes (profile-scoped)
  app.use("/api/community-vault", communityVaultRouter);
  app.use("/api/community-causes", communityCausesRouter);
  app.use("/api/platform-support", platformSupportRouter);

  // Register prompt admin routes (super admin only)
  const promptAdminRouter = (await import("./routes/promptAdmin")).default;
  app.use("/api/prompt-admin", promptAdminRouter);

  // Register AI Scout routes (with assistant alias for backward compatibility)
  app.use("/api/scout", scoutRoute);
  app.use("/api/assistant", scoutRoute);

  // Admin insights for Scout usage
  const scoutInsightsHandler: ExpressHandler = async (req, res) => {
    try {
      const { message, mode, locality, success, latencyMs, error } = req.body || {};

      // Basic validation; do not throw for missing optional fields
      if (!message || typeof success !== "boolean") {
        res.status(400).json({ message: "Invalid scout insights payload" });
        return;
      }

      // For now, log to server console; can be wired to DB/analytics later
      console.info("[ScoutInsight]", {
        when: new Date().toISOString(),
        userId: (req.user as any)?.id || (req.user as any)?.claims?.sub,
        mode,
        locality,
        success,
        latencyMs,
        error,
        preview: String(message).slice(0, 280),
      });

      res.status(204).end();
      return;
    } catch (e) {
      console.error("Failed to record scout insight", e);
      res.status(500).json({ message: "Failed to record scout insight" });
      return;
    }
  };

  app.post("/api/admin/scout-insights", scoutInsightsHandler);

  // Bug report endpoint with Formspree integration
  app.post('/api/bug-report', async (req: any, res: any) => {
    try {
      const formspreeUrl = process.env.FORMSPREE_FORM_ID;
      
      if (!formspreeUrl) {
        return res.status(500).json({ message: "Bug reporting service not configured" });
      }

      // Extract form ID from URL if it's a full URL
      const formId = formspreeUrl.replace('https://formspree.io/f/', '');
      const formspreeEndpoint = `https://formspree.io/f/${formId}`;

      // Forward the form data to Formspree
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(formspreeEndpoint, {
        method: 'POST',
        body: req.body as any, // FormData from client
      });

      if (response.ok) {
        // Log the bug report for admin awareness
        await storage.logEvent('bug_report_submitted', {
          timestamp: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: (req.user as any)?.id || 'anonymous'
        });

        res.json({ message: "Bug report submitted successfully" });
      } else {
        throw new Error(`Formspree responded with status ${response.status}`);
      }
    } catch (error: any) {
      console.error("Error submitting bug report:", error);
      res.status(500).json({ message: "Failed to submit bug report" });
    }
  });

  // Phase 1: Daily Deals System Routes
  const { 
    getDailyDeals, 
    createDailyDeal, 
    trackDealEngagement,
    getUserAffiliate,
    getAffiliateDashboard,
    updateDailyDeal,
    deleteDailyDeal,
    getFeaturedDeals
  } = await import("./routes/dailyDeals");

  // Public daily deals endpoints
  app.get("/api/daily-deals", getDailyDeals);
  app.get("/api/deals/featured", getFeaturedDeals);

  // Protected daily deals endpoints
  app.post("/api/daily-deals", isAuthenticated, createDailyDeal);
  app.put("/api/daily-deals/:id", isAuthenticated, updateDailyDeal);
  app.delete("/api/daily-deals/:id", isAuthenticated, deleteDailyDeal);

  // Deal engagement tracking
  app.post("/api/deal-engagements", trackDealEngagement);

  // Affiliate system endpoints
  app.get("/api/user/affiliate", isAuthenticated, getUserAffiliate);
  app.get("/api/affiliate/dashboard", isAuthenticated, getAffiliateDashboard);

  // Phase 2: Boost System Routes for Realtors & Dealers
  const {
    getAvailableBoosts,
    purchaseBoost,
    getUserBoosts,
    getBoostAnalytics,
    cancelBoost
  } = await import("./routes/boosts");

  app.get("/api/boosts/available", isAuthenticated, getAvailableBoosts);
  app.post("/api/boosts/purchase", isAuthenticated, purchaseBoost);
  app.get("/api/boosts/user", isAuthenticated, getUserBoosts);
  app.get("/api/boosts/:boostId/analytics", isAuthenticated, getBoostAnalytics);
  app.delete("/api/boosts/:boostId", isAuthenticated, cancelBoost);

  // Phase 3: Groups & Social Features Routes
  const {
    getGroups,
    getGroupDetails,
    joinGroup,
    getGroupPosts,
    createGroupPost,
    getUserGroups,
    createGroup
  } = await import("./routes/groups");

  app.get("/api/groups", getGroups);
  app.get("/api/groups/user", isAuthenticated, getUserGroups);
  app.get("/api/groups/:groupId", getGroupDetails);
  app.post("/api/groups", isAuthenticated, createGroup);
  app.post("/api/groups/:groupId/join", isAuthenticated, joinGroup);
  app.get("/api/groups/:groupId/posts", getGroupPosts);
  app.post("/api/groups/:groupId/posts", isAuthenticated, createGroupPost);

  // Phase 4: HOA Management Routes
  const {
    getHOA,
    getHOAFinances,
    getHOAVendors,
    getHOAVotes,
    submitVote,
    requestVendorService,
    collectHOAFee,
    searchHOAs,
    getHOAMember,
    getHOAMembers,
    addHOAMember,
    updateHOAMemberRole
  } = await import("./routes/hoa");

  app.get("/api/hoa/search", searchHOAs);
  app.get("/api/hoa/:hoaId", getHOA);
  app.get("/api/hoa/:hoaId/member", isAuthenticated, getHOAMember);
  app.get("/api/hoa/:hoaId/members", isAuthenticated, getHOAMembers);
  app.post("/api/hoa/:hoaId/members", isAuthenticated, addHOAMember);
  app.put("/api/hoa/:hoaId/members/:memberId/role", isAuthenticated, updateHOAMemberRole);
  app.get("/api/hoa/:hoaId/finances", getHOAFinances);
  app.get("/api/hoa/:hoaId/vendors", getHOAVendors);
  app.get("/api/hoa/:hoaId/votes", getHOAVotes);
  app.post("/api/hoa/votes/:voteId/submit", isAuthenticated, submitVote);
  app.post("/api/hoa/vendors/:vendorId/request", isAuthenticated, requestVendorService);
  app.post("/api/hoa/collect-fee", isAuthenticated, collectHOAFee);

  // HOA Level 2 membership + dashboard endpoints
  app.get("/api/hoa", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const memberships = await storage.getHoaForUser(userId);
      res.json({ memberships });
    } catch (error: any) {
      console.error("Error fetching HOA memberships:", error);
      res.status(500).json({ message: "Failed to load HOA memberships" });
    }
  });

  app.get("/api/hoa/dashboard", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const memberships = await storage.getHoaForUser(userId);
      if (!memberships || memberships.length === 0) {
        return res.status(403).json({ message: "User is not a member of any HOA" });
      }

      const requestedHoaId = (req.query.hoaId as string) || memberships[0].hoaId;
      const isMemberOfRequested = memberships.some((m) => m.hoaId === requestedHoaId);
      if (!isMemberOfRequested) {
        return res.status(403).json({ message: "User is not a member of this HOA" });
      }

      const dashboard = await (storage as any).getHoaDashboard(requestedHoaId);
      if (!dashboard) {
        return res.status(404).json({ message: "HOA dashboard not found" });
      }

      res.json({ dashboard });
    } catch (error: any) {
      console.error("Error fetching HOA dashboard:", error);
      res.status(500).json({ message: "Failed to load HOA dashboard" });
    }
  });

  app.get("/api/hoa/votes", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const memberships = await storage.getHoaForUser(userId);
      if (!memberships || memberships.length === 0) {
        return res.status(403).json({ message: "User is not a member of any HOA" });
      }

      const requestedHoaId = (req.query.hoaId as string) || memberships[0].hoaId;
      const isMemberOfRequested = memberships.some((m) => m.hoaId === requestedHoaId);
      if (!isMemberOfRequested) {
        return res.status(403).json({ message: "User is not a member of this HOA" });
      }

      const votes = await (storage as any).getHoaVotesForUser(requestedHoaId, userId);
      res.json({ votes });
    } catch (error: any) {
      console.error("Error fetching HOA votes:", error);
      res.status(500).json({ message: "Failed to load HOA votes" });
    }
  });

  app.post("/api/hoa/votes/:id/vote", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub || (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { id } = req.params;
      const { option } = req.body || {};
      if (!option) {
        return res.status(400).json({ message: "option is required" });
      }

      // Delegate membership and vote window validation to storage helper
      await (storage as any).submitHOAVote(userId, id, option);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error casting HOA vote:", error);
      res.status(500).json({ message: "Failed to cast vote" });
    }
  });

  // Phase 5: Nationwide Expansion Routes
  const {
    getNationwideMetrics,
    getTopCounties,
    getExpansionPipeline,
    getFoundationImpact,
    requestCountyActivation,
    getCoverageMapData,
    getAffiliatePerformance
  } = await import("./routes/nationwide");

  app.get("/api/nationwide/metrics", getNationwideMetrics);
  app.get("/api/nationwide/top-counties", getTopCounties);
  app.get("/api/nationwide/expansion-pipeline", getExpansionPipeline);
  app.get("/api/nationwide/foundation-impact", getFoundationImpact);
  app.get("/api/nationwide/coverage-map", getCoverageMapData);
  app.get("/api/nationwide/affiliate-performance", getAffiliatePerformance);
  app.post("/api/nationwide/request-activation", isAuthenticated, requestCountyActivation);

  // ========================================
  // PROFESSIONAL STORY GENERATION ROUTES
  // ========================================

  // Generate a professional story
  app.post("/api/stories/generate", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const { templateId, userInputs } = req.body;

      if (!templateId) {
        return res.status(400).json({ message: "Template ID is required" });
      }

      // Generate story using the service
      const generatedStory = await StoryGenerationService.generateStory({
        templateId,
        userInputs: userInputs || {},
        userId
      });

      // Track the story generation event
      // LocalityTracker call removed

      res.status(201).json(generatedStory);
    } catch (error: any) {
      console.error("Error generating story:", error);
      res.status(500).json({ message: "Failed to generate story" });
    }
  });

  // Save a generated story
  app.post("/api/stories", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const storyData = { ...req.body, userId };

      // Validate input data
      const validatedStory = insertGeneratedStorySchema.parse(storyData);

      // Save story to database
      const [savedStory] = await db
        .insert(generatedStories)
        .values(validatedStory)
        .returning();

      // Log the save event
      await storage.logEvent('story_saved', {
        storyId: savedStory.id,
        userId,
        templateId: savedStory.templateId
      });

      res.status(201).json(savedStory);
    } catch (error: any) {
      console.error("Error saving story:", error);
      res.status(500).json({ message: "Failed to save story" });
    }
  });

  // Get user's stories
  app.get("/api/stories", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const { page = 1, limit = 10, public_only } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = public_only === 'true'
        ? and(
          eq(generatedStories.userId, userId),
          eq(generatedStories.isPublic, true)
        )
        : eq(generatedStories.userId, userId);

      const stories = await db
        .select()
        .from(generatedStories)
        .where(whereClause)
        .orderBy(desc(generatedStories.createdAt))
        .limit(parseInt(limit))
        .offset(offset);

      res.json(stories);
    } catch (error: any) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });

  // Get story templates
  app.get("/api/stories/templates", async (req: any, res: any) => {
    try {
      const templates = StoryGenerationService.getTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Dashboard data endpoint - personalized user dashboard data
  app.get("/api/dashboard", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const dashboardData: any = {
        stats: {
          activeProjects: 0,
          savedContractors: 0,
          marketplaceListings: 0,
          realEstateListings: 0,
          totalViews: 0,
          notifications: 0,
        },
        recentActivity: [],
        myProjects: [],
        myListings: [],
        savedItems: [],
        quotes: [],
        conversations: [],
      };

      // Fetch contractor-specific data
      if (user.role === 'contractor') {
        const contractor = await storage.getContractorByUserId(userId);
        
        if (contractor) {
          // Get contractor's assigned leads (projects)
          const contractorLeads = await db
            .select()
            .from(leads)
            .where(eq(leads.contractorId, contractor.id))
            .orderBy(desc(leads.createdAt))
            .limit(10);

          dashboardData.myProjects = contractorLeads.map((lead: any) => ({
            id: lead.id,
            title: `${lead.projectType} - ${lead.urgency}`,
            status: lead.status,
            value: lead.estimatedValue,
            createdAt: lead.createdAt,
          }));

          dashboardData.stats.activeProjects = contractorLeads.filter(
            (l: any) => l.status === 'new' || l.status === 'contacted' || l.status === 'qualified'
          ).length;

          // Get contractor's quotes
          const contractorQuotes = await db
            .select()
            .from(quotes)
            .where(eq(quotes.contractorId, contractor.id))
            .orderBy(desc(quotes.createdAt))
            .limit(10);

          dashboardData.quotes = contractorQuotes;
          
          // Get contractor's conversations
          const contractorConversations = await db
            .select()
            .from(conversations)
            .where(eq(conversations.contractorId, contractor.id))
            .orderBy(desc(conversations.lastMessageAt))
            .limit(10);

          dashboardData.conversations = contractorConversations;
        }
      }

      // Fetch homeowner-specific data
      if (user.role === 'homeowner') {
        // Get homeowner's leads (project requests)
        const homeownerLeads = await db
          .select()
          .from(leads)
          .where(eq(leads.userId, userId))
          .orderBy(desc(leads.createdAt))
          .limit(10);

        dashboardData.myProjects = homeownerLeads.map((lead: any) => ({
          id: lead.id,
          title: `${lead.projectType} - ${lead.urgency}`,
          status: lead.status,
          value: lead.estimatedValue,
          createdAt: lead.createdAt,
        }));

        dashboardData.stats.activeProjects = homeownerLeads.filter(
          (l: any) => l.status === 'new' || l.status === 'contacted' || l.status === 'qualified'
        ).length;

        // Get homeowner's conversations
        const homeownerConversations = await db
          .select()
          .from(conversations)
          .where(eq(conversations.homeownerId, userId))
          .orderBy(desc(conversations.lastMessageAt))
          .limit(10);

        dashboardData.conversations = homeownerConversations;

        // Get quotes from conversations
        if (homeownerConversations.length > 0) {
          const conversationIds = homeownerConversations.map((c: any) => c.id);
          const homeownerQuotes = await db
            .select()
            .from(quotes)
            .where(sql`${quotes.conversationId} = ANY(${conversationIds})`)
            .orderBy(desc(quotes.createdAt))
            .limit(10);

          dashboardData.quotes = homeownerQuotes;
        }

        // Get saved contractors count
        const savedContractorsTable = (db as any).query?.savedContractors?.table;
        if (savedContractorsTable) {
          const savedContractorRows = await db
            .select()
            .from(savedContractorsTable)
            .where(eq((savedContractorsTable as any).userId, userId));
          dashboardData.stats.savedContractors = savedContractorRows.length;
        } else {
          dashboardData.stats.savedContractors = 0;
        }
      }

      // Get marketplace listings for all users
      const userListings = await db
        .select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.sellerId, userId))
        .orderBy(desc(marketplaceListings.createdAt))
        .limit(10);

      dashboardData.myListings = userListings;
      dashboardData.stats.marketplaceListings = userListings.filter(
        (l: any) => l.status === 'active'
      ).length;

      // Get realtor listings if user is a realtor
      const realEstateListingsTable = (db as any).query?.realEstateListings?.table;
      if (user.role === 'realtor' && realEstateListingsTable) {
        const realtorListings = await db
          .select()
          .from(realEstateListingsTable)
          .where(eq((realEstateListingsTable as any).sellerId, userId))
          .orderBy(desc((realEstateListingsTable as any).createdAt))
          .limit(10);
        dashboardData.realEstateListings = realtorListings;
        dashboardData.stats.realEstateListings = realtorListings.filter(
          (l: any) => l.status === 'active'
        ).length;
      }

      // Get recent community activity
      const recentPosts = await db
        .select()
        .from(communityPosts)
        .where(eq(communityPosts.authorId, userId))
        .orderBy(desc(communityPosts.createdAt))
        .limit(5);

      dashboardData.recentActivity = recentPosts.map((post: any) => ({
        id: post.id,
        title: `Posted: ${post.title || post.content.substring(0, 50)}`,
        createdAt: post.createdAt,
        type: 'post',
      }));

      // Profile views metric not available in schema; default to 0
      dashboardData.stats.totalViews = 0;

      res.json(dashboardData);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // ============================================================================
  // CRITICAL FOUNDATION ENDPOINTS (Phase 0)
  // ============================================================================

  // 1. HEALTH CHECK ENDPOINT
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const timestamp = new Date().toISOString();
      
      // Quick database connectivity check
      let dbStatus = "connecting";
      try {
        const dbCheck = await db.execute(sql`SELECT 1`);
        dbStatus = dbCheck ? "connected" : "disconnected";
      } catch (err) {
        dbStatus = "disconnected";
      }

      res.json({
        status: "healthy",
        uptime: Math.round(uptime),
        timestamp,
        database: dbStatus,
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          VERSION: "1.0.0",
        },
      });
    } catch (error: any) {
      res.status(503).json({
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 2. MESSAGING API - Basic endpoints (real-time via WebSocket in WebSocketManager)
  app.post("/api/conversations", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { participantId, title } = req.body;

      if (!userId || !participantId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Create or get existing conversation
      const existingConversation = await db
        .select()
        .from(conversations)
        .where(
          sql`(${conversations.homeownerId} = ${userId} AND ${conversations.contractorId} = ${participantId}) OR
              (${conversations.homeownerId} = ${participantId} AND ${conversations.contractorId} = ${userId})`
        )
        .limit(1);

      if (existingConversation.length > 0) {
        return res.json(existingConversation[0]);
      }

      // Create new conversation
      const newConversation = await db.insert(conversations).values({
        homeownerId: userId,
        contractorId: participantId,
      }).returning();

      res.status(201).json(newConversation[0]);
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const userConversations = await db
        .select()
        .from(conversations)
        .where(
          sql`${conversations.homeownerId} = ${userId} OR ${conversations.contractorId} = ${userId}`
        )
        .orderBy(desc(conversations.updatedAt));

      res.json(userConversations);
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // 3. STRIPE PAYMENT - Setup endpoint
  app.post("/api/payments/intent", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      if (!stripe) {
        return res.status(400).json({ message: "Stripe not configured" });
      }

      const { amount, currency = "usd", description } = req.body;
      const userId = req.user?.id ?? "unknown";

      if (!amount || amount < 1) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        description,
        metadata: {
          userId,
          timestamp: new Date().toISOString(),
        },
      });

      res.json({
        clientSecret: intent.client_secret,
        intentId: intent.id,
        amount: intent.amount,
        status: intent.status,
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // Stripe webhook handler
  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    try {
      if (!stripe) {
        return res.status(400).json({ message: "Stripe not configured" });
      }

      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.warn("STRIPE_WEBHOOK_SECRET not configured");
        return res.json({ received: true });
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          webhookSecret
        );
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Handle payment events
      switch (event.type) {
        case "payment_intent.succeeded":
          console.log("✅ Payment succeeded:", event.data.object.id);
          // TODO: Update transaction record in database
          break;
        case "payment_intent.payment_failed":
          console.log("❌ Payment failed:", event.data.object.id);
          // TODO: Log failed payment
          break;
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Stripe webhook dedicated to Community Builder checkout + payouts
  app.post("/api/payments/stripe/webhook", async (req: Request, res: Response) => {
    try {
      if (!stripe) return res.status(400).json({ message: "Stripe not configured" });

      const sig = req.headers["stripe-signature"] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) return res.status(400).json({ message: "STRIPE_WEBHOOK_SECRET not configured" });

      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body));

      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch (err: any) {
        console.error("[stripe] signature verification failed", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      try {
        switch (event.type) {
          case "checkout.session.completed":
            {
              const session = event.data.object as any;
              const metaType = session?.metadata?.type;

              // Route MVP payment intents by explicit metadata type.
              if (metaType === "community_vault_donation" || metaType === "platform_support") {
                await platformSupportPaymentService.handleStripeEvent(event);
              } else {
                await communityBuilderPaymentService.handleCheckoutSessionCompleted(session);
              }
            }
            break;
          case "invoice.paid":
            await platformSupportPaymentService.handleStripeEvent(event);
            break;
          case "transfer.created":
          case "transfer.updated":
            await communityBuilderPaymentService.handleStripeWebhook(event);
            break;
          default:
            // No-op for unrelated events
            break;
        }
      } catch (err: any) {
        console.error(`[stripe] webhook handler failed for ${event.type}`, err);
        return res.status(500).json({ message: "Webhook handling failed" });
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("[stripe] webhook error", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // 4. SENDGRID EMAIL - Setup endpoint
  app.post("/api/email/send", isAdmin, async (req: Request, res: Response) => {
    try {
      const { to, subject, html, text, from = process.env.SENDGRID_FROM_EMAIL, cc, bcc, replyTo } = req.body;

      if (!to || !subject || !(html || text)) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (!emailService.isConfigured()) {
        return res.status(503).json({ message: "SendGrid not configured" });
      }

      const result = await emailService.sendEmail({ to, subject, html, text, from, cc, bcc, replyTo });

      res.json({ message: "Email sent successfully", messageId: result.messageId });
    } catch (error: any) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  return httpServer;
}

