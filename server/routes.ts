import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isContractor, isAdmin, requireRole, isHeadAdmin, hashPassword, createMasterAdmin } from "./auth";
import type { AuthenticatedRequest } from "./types";
import { WebSocketManager } from "./websocket";
import { paymentService } from "./payment-service";
import Stripe from "stripe";

// Initialize Stripe (will be available when secrets are provided)
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-07-30.basil",
  });
}
import { 
  insertRealtorProfileSchema, 
  insertCarSalesmanProfileSchema,
  type InsertRealtorProfile,
  type InsertCarSalesmanProfile,
  affiliatePrograms
} from "@shared/schema";
import { setupModerationRoutes } from "./moderation";
import { registerUIIssuesRoutes } from "./routes/admin/ui-issues";
import { registerAICodeFixRoutes } from "./ai-code-fixes";
import { registerCrmRoutes } from "./crm-routes";
import { registerNotificationRoutes } from "./routes/notification-routes";
import { tutorialStorage } from "./tutorialStorage";
import { contractorSignupRouter } from "./routes/contractor-signup";

// Middleware to check address verification requirement
const requireAddressVerification = async (req: any, res: any, next: any) => {
  try {
    const user = req.user;

    // Skip for admin endpoints and certain public routes
    if (req.path.startsWith('/api/admin') || 
        req.path.startsWith('/api/address-verification') ||
        req.path.includes('/api/auth/') ||
        req.path.includes('/public-objects/')) {
      return next();
    }

    // Check if user's address is already verified
    if (user.addressVerified) {
      return next();
    }

    // Calculate if user is within the 14-day grace period
    const userCreatedAt = new Date(user.createdAt);
    const deadline = new Date(userCreatedAt);
    deadline.setDate(deadline.getDate() + 14);
    const now = new Date();

    // If deadline has passed and address not verified, block access
    if (now > deadline) {
      return res.status(403).json({ 
        message: "Address verification required. Your 14-day grace period has expired.",
        requiresAddressVerification: true,
        deadline: deadline.toISOString(),
        expired: true
      });
    }

    // If within grace period, allow access but include warning
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    res.locals.addressVerificationWarning = {
      daysRemaining,
      deadline: deadline.toISOString(),
      required: true
    };

    next();
  } catch (error) {
    console.error("Error checking address verification:", error);
    next(); // Don't block on errors
  }
};
import { db } from "./db";
import { eq, desc, and, or, isNull, isNotNull, sql } from "drizzle-orm";
import { addressVerifications, users } from "@shared/schema";
import { registerSocialRoutes } from "./social-routes";
import { 
  insertLeadSchema, 
  insertRecommendationSchema, 
  insertGrowthPackDownloadSchema, 
  insertErrorReportSchema, 
  insertContractorPromoSchema, 
  insertPromoInteractionSchema,
  insertMarketplaceCategorySchema,
  insertMarketplaceListingSchema,
  insertMarketplaceInquirySchema,
  insertMarketplaceFavoriteSchema,
  insertMarketplaceReportSchema,
  insertVendorVerificationSchema,
  insertBuyerVerificationSchema,
  insertAddressVerificationSchema,
  insertModerationReportSchema,
  insertModerationVoteSchema,
  insertModerationAppealSchema,
  insertInvitationSchema
} from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { randomUUID } from "crypto";
import passport from "passport";
import { LocalityTracker, localityTrackingMiddleware } from "./localityTracking";
import FacebookStrategy from "passport-facebook";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { dataManagementService } from "./data-management";
import { DeviceAuthService, checkTrustedDevice } from "./device-auth";

// Helper function to route leads to top contractors
async function routeLeadToTopContractors(lead: any, leadData: any) {
  try {
    const { countyId, tradeId } = lead;
    const { county, trade, city, state, zipCode } = leadData;

    if (!countyId || !tradeId) {
      console.warn("Lead missing countyId or tradeId, cannot route to top contractors.");
      return;
    }

    // Fetch top 3 contractors for the lead's area and trade
    const contractors = await storage.getContractors({
      countyId,
      tradeIds: [tradeId],
      limit: 3,
      sortBy: 'rating', // Assuming 'rating' is a valid sorting option for performance
    });

    if (!contractors || contractors.length === 0) {
      console.warn(`No top contractors found for lead ${lead.id} in county ${county} for trade ${trade}.`);
      return;
    }

    const contractorIds = contractors.map(c => c.id);
    await storage.assignLeadToContractors(lead.id, contractorIds);

    // Notify contractors about the new lead
    const leadDetails = {
      id: lead.id,
      title: lead.title,
      description: lead.description,
      location: `${city}, ${state} ${zipCode}`,
      trade: trade,
      budget: lead.budget,
      urgency: lead.urgency,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
    };

    await Promise.all(contractors.map(async (contractor) => {
      try {
        // In a real application, this would involve sending an email or push notification
        // For now, we log it
        console.log(`Notifying contractor ${contractor.companyName} (ID: ${contractor.id}) about new lead ${lead.id}`);
        
        // Example: Send notification via WebSocket or email service
        // wsManager.sendNotificationToUser(contractor.userId, {
        //   type: 'new_lead',
        //   title: 'New Lead Assigned to You!',
        //   message: `A new lead matching your services is available: ${lead.title}`,
        //   actionUrl: `/leads/${lead.id}`,
        // });

        // Log the assignment event
        await storage.logEvent('lead_assigned', {
          leadId: lead.id,
          contractorId: contractor.id,
          assignmentType: 'top3_routing',
        });

      } catch (notificationError) {
        console.error(`Failed to notify contractor ${contractor.id} for lead ${lead.id}:`, notificationError);
      }
    }));

  } catch (error) {
    console.error(`Error routing lead ${lead.id} to top contractors:`, error);
  }
}


export async function registerRoutes(app: Express) {
  // Setup authentication
  await setupAuth(app);

  // Authentication routes
  app.post("/auth/login", (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || 'Login failed' });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({ user: req.user, message: "Login successful" });
      });
    })(req, res, next);
  });

  app.post("/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, address, role = 'homeowner' } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        address,
        role: role as any,
        emailVerified: false,
        addressVerified: false,
      });

      // Auto-login after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        res.json({ user, message: "Registration successful" });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Check if platform setup is needed
  app.get("/api/auth/setup-status", async (req, res) => {
    try {
      const existingHeadAdmin = await storage.getUserByRole('head_admin');
      res.json({ needsSetup: !existingHeadAdmin });
    } catch (error) {
      console.error("Setup status check error:", error);
      res.status(500).json({ message: "Failed to check setup status" });
    }
  });

  // Master admin setup route (only works if no head_admin exists)
  app.post("/api/auth/setup-master", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Check if any head_admin already exists
      const existingHeadAdmin = await storage.getUserByRole('head_admin');
      if (existingHeadAdmin) {
        return res.status(403).json({ message: "Master admin already exists" });
      }

      const masterAdmin = await storage.createMasterAdmin(email, password, firstName, lastName);

      // Register trusted device for secure session persistence
      const sessionToken = await DeviceAuthService.registerTrustedDevice(masterAdmin.id, req, 365); // 1 year for master admin

      // Set secure cookie for trusted session
      res.cookie('trusted_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
      });

      // Auto-login the master admin
      req.login(masterAdmin, (err) => {
        if (err) {
          return res.status(500).json({ message: "Master admin created but login failed" });
        }
        res.json({ 
          user: masterAdmin, 
          message: "Master admin setup complete - device registered for secure access",
          deviceRegistered: true
        });
      });
    } catch (error) {
      console.error("Master admin setup error:", error);
      res.status(500).json({ message: "Master admin setup failed" });
    }
  });

  // Admin-only route to create new admin accounts
  app.post("/api/admin/create-account", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req, res) => {
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
    } catch (error) {
      console.error("Admin account creation error:", error);
      res.status(500).json({ message: "Account creation failed" });
    }
  });

  // Configure OAuth strategies
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy.Strategy({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "/auth/facebook/callback",
      profileFields: ['id', 'name', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await storage.getUserByEmail(profile.emails?.[0]?.value);

        if (!user) {
          user = await storage.createUser({
            email: profile.emails?.[0]?.value || '',
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            facebookId: profile.id,
            role: 'homeowner'
          });
        } else if (!user.facebookId) {
          user = await storage.updateUser(user.id, { facebookId: profile.id });
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }));
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await storage.getUserByEmail(profile.emails?.[0]?.value);

        if (!user) {
          user = await storage.createUser({
            email: profile.emails?.[0]?.value || '',
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            googleId: profile.id,
            role: 'homeowner'
          });
        } else if (!user.googleId) {
          user = await storage.updateUser(user.id, { googleId: profile.id });
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }));
  }

  // Auth middleware
  await setupAuth(app);

  // Locality tracking middleware - track all interactions with geographic context
  app.use(localityTrackingMiddleware());

  // Device auth middleware - check for trusted devices
  app.use(checkTrustedDevice);

  // Health check endpoint - must be before other routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  });

  // OAuth routes
  app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
  app.get('/auth/facebook/callback', 
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect('/profile-setup');
    });

  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect('/profile-setup');
    });

  // Admin role impersonation routes
  app.post('/api/admin/impersonate', isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res) => {
    try {
      const { role } = req.body;

      // Validate the target role
      const validRoles = ['homeowner', 'contractor_user', 'accelerator_member', 'moderator', 'ops_admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role for impersonation" });
      }

      // Store original user info in session for restoration
      req.session.originalUser = {
        id: req.user.id,
        role: req.user.role,
        email: req.user.email
      };

      // Create a temporary impersonation session
      req.session.impersonatingRole = role;
      req.session.isImpersonating = true;

      // Find a user with the target role for realistic testing
      const targetUser = await storage.getUserByRole(role);
      let userId = req.user.id; // Default to admin's ID

      if (targetUser) {
        userId = targetUser.id;
      }

      res.json({ 
        message: `Impersonation started for role: ${role}`,
        role,
        userId,
        isImpersonating: true
      });
    } catch (error) {
      console.error("Role impersonation error:", error);
      res.status(500).json({ message: "Failed to start impersonation" });
    }
  });

  app.post('/api/admin/stop-impersonation', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.session.isImpersonating || !req.session.originalUser) {
        return res.status(400).json({ message: "No active impersonation session" });
      }

      // Clear impersonation from session
      delete req.session.impersonatingRole;
      delete req.session.isImpersonating;
      delete req.session.originalUser;

      res.json({ 
        message: "Impersonation stopped",
        isImpersonating: false
      });
    } catch (error) {
      console.error("Stop impersonation error:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // Auth user endpoint - critical for useAuth hook
  app.get('/api/auth/user', async (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.user.id);

      // If impersonating, modify the user object to reflect the impersonated role
      if (req.session.isImpersonating && req.session.impersonatingRole) {
        const modifiedUser = {
          ...user,
          role: req.session.impersonatingRole,
          isImpersonating: true,
          originalRole: req.session.originalUser.role
        };
        return res.json({ ...modifiedUser, password: undefined });
      }

      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error fetching authenticated user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile routes
  app.get('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const { firstName, lastName, phone, address, city, state, zipCode, preferences } = req.body;
      const user = await storage.updateUser(req.user.id, {
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
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  app.post('/api/user/complete-onboarding', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.updateUser(req.user.id, {
        onboardingCompleted: true,
        updatedAt: new Date(),
      });
      res.json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Navigation preferences endpoints
  app.put('/api/user/navigation-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const { customOrder, hiddenFromSwipe, enableSwipeNavigation } = req.body;

      // Get current user to preserve other preferences
      const currentUser = await storage.getUser(req.user.id);
      const currentPrefs = currentUser.preferences || {};

      // Update navigation preferences
      const updatedPreferences = {
        ...currentPrefs,
        navigation: {
          customOrder,
          hiddenFromSwipe,
          enableSwipeNavigation: enableSwipeNavigation !== undefined ? enableSwipeNavigation : true
        }
      };

      const user = await storage.updateUser(req.user.id, {
        preferences: updatedPreferences,
        updatedAt: new Date(),
      });

      res.json({ 
        navigation: user.preferences?.navigation,
        message: "Navigation preferences updated successfully"
      });
    } catch (error) {
      console.error("Error updating navigation preferences:", error);
      res.status(500).json({ message: "Failed to update navigation preferences" });
    }
  });

  app.get('/api/user/navigation-preferences', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const navigationPrefs = user.preferences?.navigation || {
        customOrder: [],
        hiddenFromSwipe: [],
        enableSwipeNavigation: true
      };

      res.json(navigationPrefs);
    } catch (error) {
      console.error("Error fetching navigation preferences:", error);
      res.status(500).json({ message: "Failed to fetch navigation preferences" });
    }
  });

  // Account security and management endpoints
  app.get("/api/user/trusted-devices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const devices = await storage.getUserTrustedDevices(userId);
      res.json(devices);
    } catch (error) {
      console.error("Error fetching trusted devices:", error);
      res.status(500).json({ message: "Failed to fetch trusted devices" });
    }
  });

  app.delete("/api/user/trusted-devices/:deviceId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { deviceId } = req.params;
      await storage.removeTrustedDevice(userId, deviceId);
      res.json({ message: "Device removed successfully" });
    } catch (error) {
      console.error("Error removing trusted device:", error);
      res.status(500).json({ message: "Failed to remove trusted device" });
    }
  });

  app.get("/api/user/login-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await storage.getUserLoginHistory(userId, limit, offset);
      res.json(history);
    } catch (error) {
      console.error("Error fetching login history:", error);
      res.status(500).json({ message: "Failed to fetch login history" });
    }
  });

  app.post("/api/user/export-data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const exportData = await storage.exportUserData(userId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tradescout-data-${userId}.json"`);
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting user data:", error);
      res.status(500).json({ message: "Failed to export user data" });
    }
  });

  app.post("/api/user/deactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deactivateUser(userId);
      res.json({ message: "Account deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating account:", error);
      res.status(500).json({ message: "Failed to deactivate account" });
    }
  });

  app.delete("/api/user/delete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deleteUser(userId);
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.put("/api/user/privacy-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { profileVisibility, searchEngineIndexing } = req.body;

      // Get current user preferences
      const currentUser = await storage.getUser(userId);
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
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      res.status(500).json({ message: "Failed to update privacy settings" });
    }
  });

  app.get("/api/user/privacy-settings", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      const privacySettings = user.preferences?.privacy || {
        profileVisibility: true,
        searchEngineIndexing: false,
      };

      res.json(privacySettings);
    } catch (error) {
      console.error("Error fetching privacy settings:", error);
      res.status(500).json({ message: "Failed to fetch privacy settings" });
    }
  });

  // Profile management endpoints
  app.get('/api/auth/profile', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);

      // Include contractor-specific data if user is a contractor
      let profileData = { ...user, password: undefined };

      if (user.role === 'contractor_user') {
        const contractor = await storage.getContractorByUserId(user.id);
        if (contractor) {
          profileData = {
            ...profileData,
            companyName: contractor.companyName,
            businessDescription: contractor.businessDescription,
            licenseNumber: contractor.licenseNumber,
            yearsInBusiness: contractor.yearsInBusiness,
            isGeneralContractor: contractor.isGeneralContractor,
            isResidentialContractor: contractor.isResidentialContractor,
            acceptsSubcontractWork: contractor.acceptsSubcontractWork,
          };
        }
      }

      res.json(profileData);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.put('/api/auth/profile', isAuthenticated, async (req: any, res) => {
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

      const user = await storage.updateUser(req.user.id, {
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
      if (user.role === 'contractor_user' && (companyName || businessDescription || licenseNumber || yearsInBusiness !== undefined)) {
        const contractor = await storage.getContractorByUserId(user.id);
        if (contractor) {
          await storage.updateContractor(contractor.id, {
            companyName: companyName || contractor.companyName,
            businessDescription: businessDescription || contractor.businessDescription,
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
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  app.put('/api/auth/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await storage.getUser(req.user.id);

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
      await storage.updateUser(req.user.id, {
        password: newPasswordHash,
        updatedAt: new Date(),
      });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.put('/api/auth/notifications', isAuthenticated, async (req: any, res) => {
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

      await storage.updateUser(req.user.id, {
        preferences: preferences,
        updatedAt: new Date(),
      });

      res.json({ message: "Notification preferences updated successfully", preferences });
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // Public contractor board
  app.get("/api/contractors", async (req, res) => {
    try {
      const { county, trade, sort, limit = 20, offset = 0 } = req.query;

      // Track contractor search with locality context
      await LocalityTracker.trackInteraction('search', req, {
        searchQuery: trade as string,
        projectType: 'contractor_search',
        tradeType: trade as string
      });

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
    } catch (error) {
      console.error("Error fetching contractors:", error);
      res.status(500).json({ message: "Failed to fetch contractors" });
    }
  });

  // Contractor search endpoint (alias for contractor listing with search params)
  app.get("/api/contractors/search", async (req, res) => {
    try {
      const { county, trade, sort, limit = 20, offset = 0 } = req.query;

      // Track contractor search with locality context
      await LocalityTracker.trackInteraction('search', req, {
        searchQuery: trade as string,
        projectType: 'contractor_search',
        tradeType: trade as string
      });

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
    } catch (error) {
      console.error("Error searching contractors:", error);
      res.status(500).json({ message: "Failed to search contractors" });
    }
  });

  // Get top contractors in area (for lead assignment)
  app.get("/api/contractors/top", async (req, res) => {
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
    } catch (error) {
      console.error("Error fetching top contractors:", error);
      res.status(500).json({ message: "Failed to fetch top contractors" });
    }
  });

  // Seed database endpoint (development only)
  app.post("/api/seed-database", async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "Not allowed in production" });
      }

      const { seedDatabase } = await import("./seed-data");
      await seedDatabase();
      res.json({ message: "Database seeded successfully" });
    } catch (error) {
      console.error("Error seeding database:", error);
      res.status(500).json({ message: "Failed to seed database" });
    }
  });

  // Individual contractor profile
  app.get("/api/contractors/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const contractor = await storage.getContractorBySlug(slug);

      // Track contractor profile view with locality context
      await LocalityTracker.trackInteraction('contractor_view', req, {
        contractorId: contractor?.id,
        searchQuery: slug
      });

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
    } catch (error) {
      console.error("Error fetching contractor:", error);
      res.status(500).json({ message: "Failed to fetch contractor" });
    }
  });

  // States endpoint
  app.get("/api/states", async (req, res) => {
    try {
      const { US_STATES } = await import("@shared/us-states-counties");
      res.json(US_STATES);
    } catch (error) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

  // Counties endpoint
  app.get("/api/counties", async (req, res) => {
    try {
      const { state } = req.query;

      // Use the database storage method instead of imports
      const counties = await storage.getCounties(state as string);
      res.json(counties);
    } catch (error) {
      console.error("Error fetching counties:", error);
      res.status(500).json({ message: "Failed to fetch counties" });
    }
  });

  // Trades endpoint
  app.get("/api/trades", async (req, res) => {
    try {
      const { parent } = req.query;
      const trades = await storage.getTrades(parent as string);
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trades" });
    }
  });

  // Ad delivery for site visits with location targeting
  app.get("/api/ads/site-visit", async (req, res) => {
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
    } catch (error) {
      console.error("Error fetching targeted ad:", error);
      res.status(500).json({ message: "Failed to fetch ad" });
    }
  });

  // Track ad impressions
  app.post("/api/ads/track-impression", async (req, res) => {
    try {
      const { adId } = req.body;

      // Track ad view with locality context
      await LocalityTracker.trackAdInteraction(req, adId, 'view');

      await storage.incrementAdImpressions(adId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking impression:", error);
      res.status(500).json({ message: "Failed to track impression" });
    }
  });

  // Track ad clicks
  app.post("/api/ads/track-click", async (req, res) => {
    try {
      const { adId } = req.body;

      // Track ad click with locality context
      await LocalityTracker.trackAdInteraction(req, adId, 'click');

      await storage.incrementAdClicks(adId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // Save ad for later (authenticated users only)
  app.post("/api/ads/save", isAuthenticated, async (req, res) => {
    try {
      const { adId } = req.body;
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const savedAd = await storage.saveAdForUser(userId, adId);
      res.json(savedAd);
    } catch (error) {
      console.error("Error saving ad:", error);
      res.status(500).json({ message: "Failed to save ad" });
    }
  });

  // Get saved ads for user
  app.get("/api/saved-ads", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const savedAds = await storage.getSavedAdsForUser(userId);
      res.json(savedAds);
    } catch (error) {
      console.error("Error fetching saved ads:", error);
      res.status(500).json({ message: "Failed to fetch saved ads" });
    }
  });

  // Remove saved ad
  app.delete("/api/ads/save/:adId", isAuthenticated, async (req, res) => {
    try {
      const { adId } = req.params;
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      await storage.removeSavedAd(userId, adId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing saved ad:", error);
      res.status(500).json({ message: "Failed to remove saved ad" });
    }
  });

  // Get user notifications
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const unreadOnly = req.query.unread === 'true';

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const notifications = await storage.getUserNotifications(userId, unreadOnly);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:notificationId/read", isAuthenticated, async (req, res) => {
    try {
      const { notificationId } = req.params;
      await storage.markNotificationAsRead(notificationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.put("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      await storage.markAllNotificationsAsRead(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Admin endpoint to trigger reminder notifications (for testing)
  app.post("/api/admin/trigger-reminders", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user || !['head_admin', 'moderator', 'ops_admin'].includes(user.role || '')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { notificationService } = await import('./notification-service');
      await notificationService.triggerReminders();

      res.json({ message: "Reminder processing triggered successfully" });
    } catch (error) {
      console.error("Error triggering reminders:", error);
      res.status(500).json({ message: "Failed to trigger reminders" });
    }
  });

  // Profile setup endpoint
  app.post('/api/auth/setup-profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const { role, phone, address, city, state, zipCode, companyName, businessDescription, licenseNumber, yearsInBusiness, serviceAreas, isGeneralContractor, isResidentialContractor, acceptsSubcontractWork } = req.body;

      // Update user profile
      const updatedUser = await storage.updateUser(userId, {
        role,
        phone,
        address,
        city,
        state,
        zipCode,
        onboardingCompleted: true,
      });

      // If contractor, create contractor profile
      if (role === 'contractor_user' && companyName) {
        await storage.createContractor({
          userId,
          companyName,
          slug: companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          description: businessDescription,
          licenseNumber,
          yearsInBusiness: yearsInBusiness || 0,
          serviceAreas: serviceAreas || [],
          isVerified: false,
          phone,
          address,
          city,
          state,
          zipCode,
          isGeneralContractor: isGeneralContractor || false,
          isResidentialContractor: isResidentialContractor || false,
          acceptsSubcontractWork: acceptsSubcontractWork || false,
        });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error setting up profile:", error);
      res.status(500).json({ message: "Failed to setup profile" });
    }
  });

  // Public heatmap data endpoint (promotional feature)
  app.get("/api/heatmap", async (req, res) => {
    try {
      const timeframe = (req.query.timeframe as string) || '30d';
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;

      // Get heatmap data from locality interactions
      const heatmapData = await storage.getLocalityHeatmapData(days);

      res.json(heatmapData);
    } catch (error) {
      console.error("Error fetching heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  // County contractors endpoint
  app.get("/api/contractors/by-county", async (req, res) => {
    try {
      const { state, county } = req.query;

      if (!state || !county) {
        return res.status(400).json({ message: "State and county parameters required" });
      }

      // Get contractors for specific county (mock data for now since we don't have county-level contractor data)
      const mockContractors = [
        {
          id: "1",
          businessName: "Elite Construction Co.",
          rating: 4.8,
          reviewCount: 42,
          specialties: ["Roofing", "Siding", "General Contracting"],
          isVerified: true,
          yearsInBusiness: 15,
          phone: "(555) 123-4567",
          email: "info@eliteconstruction.com"
        },
        {
          id: "2", 
          businessName: "ProPlumb Services",
          rating: 4.6,
          reviewCount: 28,
          specialties: ["Plumbing", "Water Heaters", "Drain Cleaning"],
          isVerified: true,
          yearsInBusiness: 8,
          phone: "(555) 987-6543",
          email: "contact@proplumb.com"
        },
        {
          id: "3",
          businessName: "Spark Electric LLC",
          rating: 4.9,
          reviewCount: 56,
          specialties: ["Electrical", "Panel Upgrades", "Smart Home"],
          isVerified: true,
          yearsInBusiness: 12,
          phone: "(555) 456-7890"
        },
        {
          id: "4",
          businessName: "Perfect Paint Pro",
          rating: 4.4,
          reviewCount: 19,
          specialties: ["Interior Painting", "Exterior Painting", "Deck Staining"],
          isVerified: false,
          yearsInBusiness: 5,
          email: "hello@perfectpaintpro.com"
        }
      ];

      res.json(mockContractors);
    } catch (error) {
      console.error("Error fetching county contractors:", error);
      res.status(500).json({ message: "Failed to fetch contractors" });
    }
  });

  // Admin heatmap data endpoint (same as public but with admin context)
  app.get("/api/admin/heatmap", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error fetching heatmap data:", error);
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  // Admin user management endpoints
  app.get("/api/admin/users", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const user = await storage.getUser(userId);

      if (!user || !['head_admin', 'moderator', 'ops_admin'].includes(user.role || '')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:userId/role", isAuthenticated, async (req, res) => {
    try {
      const adminUserId = req.user?.id;
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
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.delete("/api/admin/users/:userId", isAuthenticated, async (req, res) => {
    try {
      const adminUserId = req.user?.id;
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
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Quote calculator pricing
  app.get("/api/pricing/:service", async (req, res) => {
    try {
      const { service } = req.params;
      const { fips } = req.query;

      const pricingData = await storage.getPricingData(service, fips as string);
      res.json(pricingData);
    } catch (error) {
      console.error("Error fetching pricing data:", error);
      res.status(500).json({ message: "Failed to fetch pricing data" });
    }
  });

  // Quote calculator endpoint (public access)
  app.post("/api/calculator", async (req, res) => {
    try {
      const { projectType, squareFootage, stateCode, countyFips, urgency } = req.body;

      // Track calculator usage with locality context
      await LocalityTracker.trackInteraction('quote_calculation', req, {
        projectType,
        squareFootage,
        urgency: urgency || 'planning'
      });

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
          squareFootage: sqft,
          urgency: urgency || 'planning',
          calculatedAt: new Date()
        };

        return res.json(estimate);
      }

      // Use database pricing data
      const pricing = pricingData[0];
      const sqft = parseInt(squareFootage) || 1000;
      const baseLow = parseInt(pricing.baseLow);
      const baseHigh = parseInt(pricing.baseHigh);

      // Calculate estimate based on square footage
      const low = Math.round((baseLow / 1000) * sqft);
      const high = Math.round((baseHigh / 1000) * sqft);

      // Apply urgency multiplier
      const urgencyMultiplier = urgency === 'urgent' ? 1.2 : urgency === 'soon' ? 1.1 : 1.0;

      const estimate = {
        low: Math.round(low * urgencyMultiplier),
        high: Math.round(high * urgencyMultiplier),
        projectType,
        squareFootage: sqft,
        urgency: urgency || 'planning',
        calculatedAt: new Date()
      };

      res.json(estimate);
    } catch (error) {
      console.error("Error calculating estimate:", error);
      res.status(500).json({ message: "Failed to calculate estimate" });
    }
  });

  // Lead submission (public - no auth required for homeowners to get quotes)
  app.post("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      // User ID is optional for public lead submissions, but we capture it if available
      const userId = req.user?.id || null;
      const leadData = { ...req.body, userId };

      // Track quote request with locality context
      await LocalityTracker.trackInteraction('quote_request', req, {
        projectType: leadData.projectType,
        trade: leadData.trade, // Use 'trade' from body for tracking
        quoteAmount: leadData.budget
      });

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
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // Recommendations (requires auth)
  app.post("/api/recommendations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const recommendationData = { ...req.body, userId };

      // Track rating submission with locality context
      await LocalityTracker.trackInteraction('rating_submit', req, {
        contractorId: recommendationData.contractorId,
        rating: recommendationData.rating,
        projectType: 'recommendation'
      });

      const validatedRecommendation = insertRecommendationSchema.parse(recommendationData);
      const recommendation = await storage.createRecommendation(validatedRecommendation);

      // Update leaderboard stats when recommendation is created
      await storage.updateContractorLeaderboardStats(recommendationData.contractorId, recommendationData.rating);

      await storage.logEvent('recommendation_submitted', {
        recommendationId: recommendation.id,
        contractorId: recommendation.contractorId,
        userId,
      });

      res.json(recommendation);
    } catch (error) {
      console.error("Error creating recommendation:", error);
      res.status(500).json({ message: "Failed to create recommendation" });
    }
  });

  // Contractor leaderboards
  app.get("/api/leaderboard/monthly", async (req, res) => {
    try {
      const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const state = req.query.state as string;
      const county = req.query.county as string;

      const leaderboard = await storage.getMonthlyLeaderboard(month, year, limit, state, county);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching monthly leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch monthly leaderboard" });
    }
  });

  app.get("/api/leaderboard/lifetime", async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const state = req.query.state as string;
      const county = req.query.county as string;

      const leaderboard = await storage.getLifetimeLeaderboard(limit, state, county);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching lifetime leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch lifetime leaderboard" });
    }
  });

  app.get("/api/leaderboard/contractor/:contractorId", async (req, res) => {
    try {
      const { contractorId } = req.params;
      const stats = await storage.getContractorLeaderboardPosition(contractorId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching contractor leaderboard position:", error);
      res.status(500).json({ message: "Failed to fetch contractor position" });
    }
  });

  // States API for geographic filtering
  app.get("/api/states", async (req, res) => {
    try {
      const states = await storage.getAllStates();
      res.json(states);
    } catch (error) {
      console.error("Error fetching states:", error);
      res.status(500).json({ message: "Failed to fetch states" });
    }
  });

  // Counties API for geographic filtering
  app.get("/api/counties", async (req, res) => {
    try {
      const state = req.query.state as string;
      const counties = await storage.getCountiesByState(state);
      res.json(counties);
    } catch (error) {
      console.error("Error fetching counties:", error);
      res.status(500).json({ message: "Failed to fetch counties" });
    }
  });

  // Growth Pack download (requires contractor account)
  app.post("/api/growth-pack", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
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
    } catch (error) {
      console.error("Error creating Growth Pack download:", error);
      res.status(500).json({ message: "Failed to request Growth Pack" });
    }
  });

  // Growth Pack download link
  app.get("/api/growth-pack/download/:token", async (req, res) => {
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
    } catch (error) {
      console.error("Error processing Growth Pack download:", error);
      res.status(500).json({ message: "Failed to process download" });
    }
  });

  // Pricing Analytics Routes (Admin Only)
  app.get("/api/admin/pricing-analytics", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res) => {
    try {
      const { timeframe = '30d' } = req.query;
      const { pricingAnalyticsService } = await import('./pricing-analytics');

      const analytics = await pricingAnalyticsService.getPricingAnalytics(timeframe as any);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching pricing analytics:", error);
      res.status(500).json({ message: "Failed to fetch pricing analytics" });
    }
  });

  app.post("/api/admin/pricing-analytics/update-calculator", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res) => {
    try {
      const { threshold = 10 } = req.body;
      const { pricingAnalyticsService } = await import('./pricing-analytics');

      const result = await pricingAnalyticsService.updateCalculatorPricing(threshold);

      // Log the pricing update
      await storage.logEvent('pricing_calculator_updated', {
        adminId: req.user.id,
        updatedCount: result.updatedCount,
        updates: result.updates
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating calculator pricing:", error);
      res.status(500).json({ message: "Failed to update calculator pricing" });
    }
  });

  app.get("/api/admin/pricing-analytics/export", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res) => {
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
    } catch (error) {
      console.error("Error exporting pricing analytics:", error);
      res.status(500).json({ message: "Failed to export pricing analytics" });
    }
  });

  app.get("/api/admin/pricing-analytics/recommendations", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res) => {
    try {
      const { stateCode } = req.query;
      const { pricingAnalyticsService } = await import('./pricing-analytics');

      const recommendations = await pricingAnalyticsService.getRegionalPricingRecommendations(stateCode);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching pricing recommendations:", error);
      res.status(500).json({ message: "Failed to fetch pricing recommendations" });
    }
  });

  // Contractor dashboard (requires contractor auth)
  app.get("/api/contractor/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;

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
    } catch (error) {
      console.error("Error fetching contractor dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Event tracking endpoint
  app.post("/api/events", async (req, res) => {
    try {
      const { eventType, data } = req.body;

      await storage.logEvent(eventType, {
        ...data,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({ message: "Event logged successfully" });
    } catch (error) {
      console.error("Error logging event:", error);
      res.status(500).json({ message: "Failed to log event" });
    }
  });

  // Admin analytics (requires admin auth)
  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Contractor application submission
  app.post("/api/contractors/apply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Track contractor application with locality context
      await LocalityTracker.trackInteraction('profile_create', req, {
        searchQuery: 'contractor_application',
        projectType: 'contractor_signup'
      });

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

      // Update user role to contractor_user
      await storage.updateUser(userId, { 
        role: 'contractor_user',
        onboardingCompleted: true 
      });

      console.log('New contractor application created:', contractor.id);

      res.json({ 
        message: "Application submitted successfully",
        contractorId: contractor.id,
        status: 'pending_verification'
      });
    } catch (error) {
      console.error("Error submitting contractor application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Admin: Get contractor applications
  app.get("/api/admin/contractor-applications", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res) => {
    try {
      const { status, limit = 50 } = req.query;
      const applications = await storage.getContractorApplications({ 
        status: status as string,
        limit: parseInt(limit as string) 
      });
      
      res.json(applications);
    } catch (error) {
      console.error("Error fetching contractor applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Admin: Update contractor application status
  app.patch("/api/admin/contractor-applications/:id", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, reviewNotes } = req.body;
      const adminId = req.user?.id;

      await storage.updateContractorApplication(id, {
        status,
        reviewNotes,
        reviewedBy: adminId,
        reviewedAt: new Date()
      });

      res.json({ message: "Application status updated successfully" });
    } catch (error) {
      console.error("Error updating contractor application:", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  // Accelerator enrollment
  app.post("/api/accelerator/enroll", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check if user is a verified contractor
      if (user.role !== 'contractor_user') {
        return res.status(403).json({ message: "Only contractors can join the Accelerator program" });
      }

      if (user.verificationStatus !== 'verified') {
        return res.status(403).json({ message: "Contractor verification required to join Accelerator program" });
      }

      const { planType } = req.body;

      // Track accelerator enrollment with locality context
      await LocalityTracker.trackInteraction('accelerator_inquiry', req, {
        searchQuery: planType,
        projectType: 'accelerator_enrollment'
      });

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
    } catch (error) {
      console.error("Error processing accelerator enrollment:", error);
      res.status(500).json({ message: "Failed to process enrollment" });
    }
  });

  // Exchange routes
  app.get("/api/exchange/items", async (req, res) => {
    try {
      // Mock exchange items - replace with real database call
      const mockItems = [
        {
          id: "1",
          title: "Professional Grade Circular Saw",
          description: "DeWalt 20V Max Circular Saw with blade. Excellent condition, barely used.",
          price: 1200,
          category: "tools",
          condition: "like-new",
          images: [],
          location: "Los Angeles, CA",
          seller: {
            id: "seller1",
            name: "John Smith",
            rating: 4.8,
            verified: true
          },
          createdAt: "2025-01-10T00:00:00Z",
          featured: true,
          views: 150,
          favorites: 12
        },
        {
          id: "2", 
          title: "Premium Hardwood Flooring",
          description: "Oak hardwood flooring, 500 sq ft available. Perfect for renovation projects.",
          price: 3500,
          category: "materials",
          condition: "new",
          images: [],
          location: "Orange County, CA",
          seller: {
            id: "seller2",
            name: "Materials Plus",
            rating: 4.9,
            verified: true
          },
          createdAt: "2025-01-09T00:00:00Z",
          featured: false,
          views: 89,
          favorites: 7
        }
      ];

      res.json(mockItems);
    } catch (error) {
      console.error("Error fetching exchange items:", error);
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  // Exchange contractor promotions
  app.get("/api/exchange/contractor-promos", async (req, res) => {
    try {
      const { search, category, sort } = req.query;
      
      // Mock contractor promotions - replace with real database call
      const mockPromos = [
        {
          id: "promo1",
          contractorId: "contractor1",
          title: "Spring Renovation Special",
          description: "Get ready for spring with our comprehensive renovation package.",
          offerDetails: "15% off all kitchen renovations over $10,000",
          discountType: "percentage",
          discountValue: 15,
          minimumJobValue: 10000,
          promoCode: "SPRING15",
          isActive: true,
          maxUses: 50,
          currentUses: 12,
          serviceAreas: ["Los Angeles County", "Orange County"],
          tradeCategories: ["kitchen", "renovation"],
          startsAt: "2025-03-01T00:00:00Z",
          expiresAt: "2025-05-31T23:59:59Z",
          slug: "spring-renovation-special",
          viewCount: 234,
          clickCount: 45,
          leadCount: 8,
          contractor: {
            id: "contractor1",
            name: "Mike Johnson",
            businessName: "Johnson Construction",
            rating: 4.9,
            verified: true,
            phone: "(555) 123-4567"
          }
        },
        {
          id: "promo2",
          contractorId: "contractor2", 
          title: "Roofing Emergency Service",
          description: "24/7 emergency roofing repairs with guaranteed response time.",
          offerDetails: "Free estimate + 10% off emergency repairs",
          discountType: "percentage",
          discountValue: 10,
          promoCode: "EMERGENCY10",
          isActive: true,
          maxUses: null,
          currentUses: 28,
          serviceAreas: ["Los Angeles County"],
          tradeCategories: ["roofing", "emergency"],
          startsAt: "2025-01-01T00:00:00Z",
          expiresAt: null,
          slug: "roofing-emergency-service",
          viewCount: 189,
          clickCount: 67,
          leadCount: 15,
          contractor: {
            id: "contractor2",
            name: "Sarah Davis",
            businessName: "Davis Roofing Solutions",
            rating: 4.8,
            verified: true,
            phone: "(555) 987-6543"
          }
        }
      ];

      res.json(mockPromos);
    } catch (error) {
      console.error("Error fetching contractor promotions:", error);
      res.status(500).json({ message: "Failed to fetch contractor promotions" });
    }
  });

  // Exchange company promotions
  app.get("/api/exchange/company-promotions", async (req, res) => {
    try {
      const { search, dealType, sort } = req.query;
      
      // Mock company promotions - replace with real database call
      const mockPromotions = [
        {
          id: "company1",
          companyName: "Harbor Freight Tools",
          companyLogo: "https://images.harborfreight.com/hftweb/images/harborfreight-logo.svg",
          companyWebsite: "https://harborfreight.com",
          title: "Professional Tool Mega Sale",
          description: "Massive savings on professional-grade tools and equipment.",
          dealDetails: "Up to 70% off select power tools",
          dealType: "percentage_off",
          discountValue: 70,
          originalPrice: null,
          salePrice: null,
          promoCode: "TOOLS70",
          minimumPurchase: 50,
          maxDiscount: 500,
          productCategories: ["power_tools", "hand_tools", "equipment"],
          targetAudience: ["contractors", "professionals", "diy"],
          startsAt: "2025-01-15T00:00:00Z",
          expiresAt: "2025-02-15T23:59:59Z",
          isActive: true,
          isFeatured: true,
          availableStates: ["CA", "NV", "AZ"],
          storeLocationsOnly: false,
          slug: "harbor-freight-tool-mega-sale",
          viewCount: 1250,
          clickCount: 312,
          redemptionCount: 87,
          terms: "Valid on select items only. Cannot be combined with other offers.",
          restrictions: "Limit one per customer. Valid through 2/15/25."
        },
        {
          id: "company2",
          companyName: "Home Depot",
          companyLogo: "https://corporate.homedepot.com/sites/default/files/image_gallery/THD_logo_RGB_2C.png",
          companyWebsite: "https://homedepot.com",
          title: "Contractor Bulk Pricing",
          description: "Special bulk pricing for contractors on building materials.",
          dealDetails: "Buy 10+ items, get 25% off lumber and materials",
          dealType: "percentage_off",
          discountValue: 25,
          promoCode: "BULK25",
          minimumPurchase: 1000,
          productCategories: ["lumber", "materials", "hardware"],
          targetAudience: ["contractors", "professionals"],
          startsAt: "2025-01-01T00:00:00Z",
          expiresAt: "2025-12-31T23:59:59Z",
          isActive: true,
          isFeatured: false,
          storeLocationsOnly: true,
          slug: "home-depot-contractor-bulk",
          viewCount: 890,
          clickCount: 245,
          redemptionCount: 156,
          terms: "Valid for verified contractors only. Proof of contractor license required.",
          restrictions: "Cannot be combined with other contractor discounts."
        }
      ];

      res.json(mockPromotions);
    } catch (error) {
      console.error("Error fetching company promotions:", error);
      res.status(500).json({ message: "Failed to fetch company promotions" });
    }
  });

  // Chat system routes
  // Conversations
  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const { contractorId, leadId } = req.body;

      const conversation = await storage.createConversation({
        homeownerId: userId,
        contractorId,
        leadId,
      });
      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const userType = req.query.userType || 'homeowner'; 

      const conversations = await storage.getConversationsByUser(userId, userType);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      if (conversation.homeownerId !== userId && conversation.contractorId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations/:id/rate", isAuthenticated, async (req: any, res) => {
    try {
      const { rating, feedback } = req.body;
      const userId = (req.user as any)?.claims?.sub || req.user?.id;

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
    } catch (error) {
      console.error("Error rating conversation:", error);
      res.status(500).json({ message: "Failed to rate conversation" });
    }
  });

  // Messages
  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
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
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;

      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (conversation.homeownerId !== userId && conversation.contractorId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Quotes  
  app.post("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const contractorId = (req.user as any)?.claims?.sub || req.user?.id;
      const quoteData = { ...req.body, contractorId };

      // Track contractor quote submission with locality context
      await LocalityTracker.trackInteraction('lead_assignment', req, {
        contractorId,
        projectType: 'quote_submission',
        quoteAmount: quoteData.amount
      });

      const quote = await storage.createQuote(quoteData);
      res.json(quote);
    } catch (error) {
      console.error("Error creating quote:", error);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  app.get("/api/conversations/:id/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const quotes = await storage.getQuotesByConversation(req.params.id);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.put("/api/quotes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const quote = await storage.updateQuote(req.params.id, req.body);
      res.json(quote);
    } catch (error) {
      console.error("Error updating quote:", error);
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  // Material Lists
  app.post("/api/material-lists", isAuthenticated, async (req: any, res) => {
    try {
      const contractorId = (req.user as any)?.claims?.sub || req.user?.id;
      const materialListData = { ...req.body, contractorId };

      const materialList = await storage.createMaterialList(materialListData);
      res.json(materialList);
    } catch (error) {
      console.error("Error creating material list:", error);
      res.status(500).json({ message: "Failed to create material list" });
    }
  });

  app.get("/api/conversations/:id/material-lists", isAuthenticated, async (req: any, res) => {
    try {
      const materialLists = await storage.getMaterialListsByConversation(req.params.id);
      res.json(materialLists);
    } catch (error) {
      console.error("Error fetching material lists:", error);
      res.status(500).json({ message: "Failed to fetch material lists" });
    }
  });

  app.put("/api/material-lists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const materialList = await storage.updateMaterialList(req.params.id, req.body);
      res.json(materialList);
    } catch (error) {
      console.error("Error updating material list:", error);
      res.status(500).json({ message: "Failed to update material list" });
    }
  });

  // Add item suggestion to material list
  app.post("/api/material-lists/:materialListId/suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const { materialListId } = req.params;
      const { name, quantity, estimatedCost, vendor, sku, notes } = req.body;
      const userId = req.user?.claims?.sub;

      if (!name || !quantity || estimatedCost === undefined) {
        return res.status(400).json({ message: "Name, quantity, and estimated cost are required" });
      }

      // Generate unique ID for the suggestion
      const { randomUUID } = await import("crypto");
      const suggestionId = randomUUID();

      // Determine who is suggesting (homeowner or contractor)
      const suggestion = {
        id: suggestionId,
        name,
        quantity: Number(quantity),
        estimatedCost: Number(estimatedCost),
        vendor: vendor || 'Home Depot',
        sku,
        suggestedBy: req.user?.role === 'contractor_user' ? 'contractor' as const : 'homeowner' as const,
        notes,
      };

      const updatedMaterialList = await storage.addMaterialListItemSuggestion(materialListId, suggestion);
      res.json(updatedMaterialList);
    } catch (error) {
      console.error("Error adding suggestion:", error);
      res.status(500).json({ message: "Failed to add suggestion" });
    }
  });

  // Approve or deny item suggestion
  app.patch("/api/material-lists/:materialListId/items/:itemId/status", isAuthenticated, async (req: any, res) => {
    try {
      const { materialListId, itemId } = req.params;
      const { status, denialReason } = req.body;

      if (!['approved', 'denied'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'denied'" });
      }

      if (status === 'denied' && !denialReason) {
        return res.status(400).json({ message: "Denial reason is required when denying a suggestion" });
      }

      const updatedMaterialList = await storage.updateMaterialListItemStatus(
        materialListId,
        itemId,
        status,
        denialReason
      );

      res.json(updatedMaterialList);
    } catch (error) {
      console.error("Error updating item status:", error);
      res.status(500).json({ message: "Failed to update item status" });
    }
  });

  // Admin panel routes (require admin access)
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user || !['owner', 'ops_admin'].includes(req.user.claims?.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Site settings management
  app.get("/api/admin/site-settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { category } = req.query;
      const settings = await storage.getSiteSettings(category as string);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching site settings:", error);
      res.status(500).json({ message: "Failed to fetch site settings" });
    }
  });

  app.post("/api/admin/site-settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const setting = await storage.createSiteSetting(req.body);
      res.json(setting);
    } catch (error) {
      console.error("Error creating site setting:", error);
      res.status(500).json({ message: "Failed to create site setting" });
    }
  });

  app.put("/api/admin/site-settings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const setting = await storage.updateSiteSetting(req.params.id, req.body);
      res.json(setting);
    } catch (error) {
      console.error("Error updating site setting:", error);
      res.status(500).json({ message: "Failed to update site setting" });
    }
  });

  app.delete("/api/admin/site-settings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteSiteSetting(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting site setting:", error);
      res.status(500).json({ message: "Failed to delete site setting" });
    }
  });

  // Prize configuration management
  app.get("/api/admin/prizes", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const prizes = await storage.getPrizeConfigurations();
      res.json(prizes);
    } catch (error) {
      console.error("Error fetching prizes:", error);
      res.status(500).json({ message: "Failed to fetch prizes" });
    }
  });

  app.post("/api/admin/prizes", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const prize = await storage.createPrizeConfiguration(req.body);
      res.json(prize);
    } catch (error) {
      console.error("Error creating prize:", error);
      res.status(500).json({ message: "Failed to create prize" });
    }
  });

  app.put("/api/admin/prizes/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const prize = await storage.updatePrizeConfiguration(req.params.id, req.body);
      res.json(prize);
    } catch (error) {
      console.error("Error updating prize:", error);
      res.status(500).json({ message: "Failed to update prize" });
    }
  });

  app.delete("/api/admin/prizes/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deletePrizeConfiguration(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting prize:", error);
      res.status(500).json({ message: "Failed to delete prize" });
    }
  });

  // Advertisement management
  app.get("/api/admin/advertisements", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { placement } = req.query;
      const ads = await storage.getAdvertisements(placement as string);
      res.json(ads);
    } catch (error) {
      console.error("Error fetching advertisements:", error);
      res.status(500).json({ message: "Failed to fetch advertisements" });
    }
  });

  app.post("/api/admin/advertisements", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const ad = await storage.createAdvertisement(req.body);
      res.json(ad);
    } catch (error) {
      console.error("Error creating advertisement:", error);
      res.status(500).json({ message: "Failed to create advertisement" });
    }
  });

  app.put("/api/admin/advertisements/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const ad = await storage.updateAdvertisement(req.params.id, req.body);
      res.json(ad);
    } catch (error) {
      console.error("Error updating advertisement:", error);
      res.status(500).json({ message: "Failed to update advertisement" });
    }
  });

  app.delete("/api/admin/advertisements/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteAdvertisement(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting advertisement:", error);
      res.status(500).json({ message: "Failed to delete advertisement" });
    }
  });

  // Marketplace conversation endpoints
  app.get("/api/marketplace/conversations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const conversations = await storage.getUserMarketplaceConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/marketplace/conversations", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
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
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/marketplace/conversations/:conversationId/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const { conversationId } = req.params;

      // Verify user is part of conversation
      const conversation = await storage.getMarketplaceConversation(conversationId);
      if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMarketplaceMessages(conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/marketplace/conversations/:conversationId/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
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
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.put("/api/marketplace/conversations/:conversationId/read", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const { conversationId } = req.params;

      // Verify user is part of conversation
      const conversation = await storage.getMarketplaceConversation(conversationId);
      if (!conversation || (conversation.buyerId !== userId && conversation.sellerId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.markMarketplaceMessagesAsRead(conversationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Professional verification endpoints
  app.get("/api/admin/professional/pending", isAuthenticated, async (req: any, res) => {
    if (!["head_admin", "ops_admin", "moderator"].includes(req.user?.claims?.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const [realtors, carSalesmen] = await Promise.all([
        storage.getPendingRealtorApplications(),
        storage.getPendingCarSalesmanApplications()
      ]);

      res.json({ realtors, carSalesmen });
    } catch (error) {
      console.error("Error fetching pending applications:", error);
      res.status(500).json({ message: "Failed to fetch pending applications" });
    }
  });

  // Realtor verification
  app.post("/api/admin/realtor/verify/:profileId", isAuthenticated, async (req: any, res) => {
    if (!["head_admin", "ops_admin", "moderator"].includes(req.user?.claims?.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { profileId } = req.params;
      const { approved, notes } = req.body;
      const adminId = (req.user as any)?.claims?.sub || req.user?.id;

      const result = await storage.updateRealtorVerificationStatus(
        profileId,
        approved ? 'approved' : 'rejected',
        adminId,
        notes
      );

      res.json(result);
    } catch (error) {
      console.error("Error updating realtor verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // Car salesman verification
  app.post("/api/admin/car-salesman/verify/:profileId", isAuthenticated, async (req: any, res) => {
    if (!["head_admin", "ops_admin", "moderator"].includes(req.user?.claims?.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      const { profileId } = req.params;
      const { approved, notes } = req.body;
      const adminId = (req.user as any)?.claims?.sub || req.user?.id;

      const result = await storage.updateCarSalesmanVerificationStatus(
        profileId,
        approved ? 'approved' : 'rejected',
        adminId,
        notes
      );

      res.json(result);
    } catch (error) {
      console.error("Error updating car salesman verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // Contractor settings management
  app.get("/api/admin/contractor-settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { category } = req.query;
      const settings = await storage.getContractorSettings(category as string);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching contractor settings:", error);
      res.status(500).json({ message: "Failed to fetch contractor settings" });
    }
  });

  app.post("/api/admin/contractor-settings", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const setting = await storage.createContractorSetting(req.body);
      res.json(setting);
    } catch (error) {
      console.error("Error creating contractor setting:", error);
      res.status(500).json({ message: "Failed to create contractor setting" });
    }
  });

  app.put("/api/admin/contractor-settings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const setting = await storage.updateContractorSetting(req.params.id, req.body);
      res.json(setting);
    } catch (error) {
      console.error("Error updating contractor setting:", error);
      res.status(500).json({ message: "Failed to update contractor setting" });
    }
  });

  app.delete("/api/admin/contractor-settings/:id", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      await storage.deleteContractorSetting(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contractor setting:", error);
      res.status(500).json({ message: "Failed to delete contractor setting" });
    }
  });

  // Worker marketplace endpoints
  app.get("/api/workers", async (req, res) => {
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
              description: "Installed custom kitchen cabinets, including hardware mounting and adjustment. Completed on time with excellent customer feedback.",
              isCurrentJob: false,
              fromPlatform: true,
              taskId: "task-123"
            },
            {
              jobTitle: "Bathroom Renovation Assistant",
              company: "Smith Contractors",
              startDate: "2023-08-01",
              endDate: "2024-12-31",
              description: "Assist lead contractor with bathroom renovations, tile installation, and fixture mounting. Regular employment position.",
              isCurrentJob: true,
              fromPlatform: true,
              taskId: "task-456"
            },
            {
              jobTitle: "Construction Helper",
              company: "ABC Construction Co.",
              startDate: "2019-03-01",
              endDate: "2023-07-15",
              description: "General construction labor including framing, concrete work, and site cleanup. Promoted to crew lead after 2 years.",
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
              description: "Complete kitchen cabinet installation including crown molding and under-cabinet lighting preparation.",
              completionDate: "2024-01-22",
              skills: ["carpentry", "measurements", "hardware-installation"],
              fromPlatform: true,
              taskId: "task-123"
            },
            {
              title: "Deck Repair and Staining",
              description: "Repaired loose boards, replaced damaged sections, and applied weatherproof stain to 400 sq ft deck.",
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
              description: "Installed 3 ceiling fans with remote controls, including electrical wiring and wall switch installation.",
              isCurrentJob: false,
              fromPlatform: true,
              taskId: "task-321"
            },
            {
              jobTitle: "Electrical Assistant",
              company: "Martinez Electric LLC",
              startDate: "2021-06-01",
              endDate: "2023-12-31",
              description: "Assisted master electrician with residential and commercial electrical installations. Learned advanced wiring techniques.",
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
              description: "Upgraded electrical panel and installed dedicated circuits for home office equipment.",
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
    } catch (error) {
      console.error("Error fetching workers:", error);
      res.status(500).json({ message: "Failed to fetch workers" });
    }
  });

  app.get("/api/tasks", async (req, res) => {
    try {
      // For now, return empty array - will be populated when database is set up
      res.json([]);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/task-categories", async (req, res) => {
    try {
      const { TASK_CATEGORIES } = await import("@shared/task-categories");
      res.json(TASK_CATEGORIES);
    } catch (error) {
      console.error("Error fetching task categories:", error);
      res.status(500).json({ message: "Failed to fetch task categories" });
    }
  });

  // Worker registration endpoint
  app.post("/api/workers/register", async (req, res) => {
    try {
      // TODO: Implement worker registration when database is set up
      res.json({ message: "Worker registration endpoint ready" });
    } catch (error) {
      console.error("Error registering worker:", error);
      res.status(500).json({ message: "Failed to register worker" });
    }
  });

  // Task posting endpoint
  app.post("/api/tasks", async (req, res) => {
    try {
      // TODO: Implement task posting when database is set up
      res.json({ message: "Task posting endpoint ready" });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Task application endpoint
  app.post("/api/tasks/:taskId/apply", async (req, res) => {
    try {
      // TODO: Implement task application when database is set up
      res.json({ message: "Task application endpoint ready" });
    } catch (error) {
      console.error("Error applying to task:", error);
      res.status(500).json({ message: "Failed to apply to task" });
    }
  });

  // Worker verification endpoint
  app.post("/api/workers/:workerId/verify", async (req, res) => {
    try {
      // TODO: Implement verification when database is set up
      res.json({ message: "Worker verification endpoint ready" });
    } catch (error) {
      console.error("Error verifying worker:", error);
      res.status(500).json({ message: "Failed to verify worker" });
    }
  });

  // Helper dashboard specific endpoints
  app.get("/api/workers/profile", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'helper') {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }
      
      // For now, return a default helper profile - will be implemented when database is ready
      const helperProfile = {
        id: req.user.id,
        userId: req.user.id,
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
    } catch (error) {
      console.error("Error fetching helper profile:", error);
      res.status(500).json({ message: "Failed to fetch helper profile" });
    }
  });

  app.get("/api/tasks/available", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'helper') {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }
      
      // Return sample available tasks
      const availableTasks = [
        {
          id: 'task-1',
          title: 'Furniture Assembly Help',
          description: 'Need help assembling IKEA furniture in living room. Should take 2-3 hours.',
          posterType: 'homeowner',
          payType: 'hourly',
          payAmount: '25.00',
          city: 'Seattle',
          stateCode: 'WA',
          schedulingType: 'flexible',
          requiredSkills: ['Assembly', 'Basic Tools'],
          status: 'open',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'task-2',
          title: 'House Cleaning',
          description: 'Deep cleaning of 3-bedroom house. All supplies provided.',
          posterType: 'homeowner',
          payType: 'fixed',
          payAmount: '150.00',
          city: 'Portland',
          stateCode: 'OR',
          schedulingType: 'scheduled',
          requiredSkills: ['Cleaning', 'Attention to Detail'],
          status: 'open',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'task-3',
          title: 'Job Site Labor',
          description: 'Need extra hands for roofing project. Must have construction experience.',
          posterType: 'contractor',
          payType: 'hourly',
          payAmount: '35.00',
          city: 'Vancouver',
          stateCode: 'WA',
          schedulingType: 'asap',
          requiredSkills: ['Construction', 'Physical Strength', 'Roofing'],
          status: 'open',
          createdAt: new Date().toISOString(),
        }
      ];
      
      res.json(availableTasks);
    } catch (error) {
      console.error("Error fetching available tasks:", error);
      res.status(500).json({ message: "Failed to fetch available tasks" });
    }
  });

  app.get("/api/workers/applications", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'helper') {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }
      
      // Return sample applications
      const applications = [
        {
          id: 'app-1',
          taskId: 'task-1',
          workerId: req.user.id,
          message: 'I have extensive experience with furniture assembly and own all necessary tools.',
          proposedRate: '25.00',
          status: 'pending',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'app-2',
          taskId: 'task-2',
          workerId: req.user.id,
          message: 'Available for this cleaning job. I have 3 years of professional cleaning experience.',
          status: 'accepted',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        }
      ];
      
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get("/api/workers/completed-jobs", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== 'helper') {
        return res.status(403).json({ message: "Access denied. Helper role required." });
      }
      
      // Return sample completed jobs
      const completedJobs = [
        {
          id: 'job-1',
          title: 'Garden Cleanup',
          description: 'Seasonal garden cleanup and maintenance.',
          payAmount: '120.00',
          city: 'Seattle',
          stateCode: 'WA',
          status: 'completed',
          completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'job-2',
          title: 'Moving Assistance',
          description: 'Help loading and unloading moving truck.',
          payAmount: '80.00',
          city: 'Tacoma',
          stateCode: 'WA',
          status: 'completed',
          completedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        }
      ];
      
      res.json(completedJobs);
    } catch (error) {
      console.error("Error fetching completed jobs:", error);
      res.status(500).json({ message: "Failed to fetch completed jobs" });
    }
  });

  app.get("/api/workers/reviews", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Error reporting endpoints
  // Object Storage Routes for File Uploads
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/error-reports", async (req: any, res) => {
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
    } catch (error) {
      console.error("Error creating error report:", error);
      res.status(500).json({ message: "Failed to submit error report" });
    }
  });

  // ===== CONTRACTOR PROMO ROUTES =====

  // Create new promo (contractor users only)
  app.post("/api/contractor-promos", isAuthenticated, isContractor, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

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
    } catch (error) {
      console.error("Error creating contractor promo:", error);
      res.status(500).json({ message: "Failed to create promo" });
    }
  });

  // Get contractor's promos
  app.get("/api/contractor-promos", isAuthenticated, isContractor, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

      const contractor = await storage.getContractorByUserId(userId);
      if (!contractor) {
        return res.status(403).json({ message: "Contractor not found" });
      }

      const promos = await storage.getContractorPromos(contractor.id);
      res.json(promos);
    } catch (error) {
      console.error("Error fetching contractor promos:", error);
      res.status(500).json({ message: "Failed to fetch promos" });
    }
  });

  // Update promo
  app.put("/api/contractor-promos/:promoId", isAuthenticated, isContractor, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error updating contractor promo:", error);
      res.status(500).json({ message: "Failed to update promo" });
    }
  });

  // Delete promo
  app.delete("/api/contractor-promos/:promoId", isAuthenticated, isContractor, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error deleting contractor promo:", error);
      res.status(500).json({ message: "Failed to delete promo" });
    }
  });

  // Public promo viewing (by slug) 
  app.get("/promo/:slug", async (req: any, res) => {
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
      if (promo.maxUses && promo.currentUses >= promo.maxUses) {
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
    } catch (error) {
      console.error("Error fetching promo:", error);
      res.status(500).json({ message: "Failed to fetch promo" });
    }
  });

  // Track promo click
  app.post("/api/promo/:slug/click", async (req: any, res) => {
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
    } catch (error) {
      console.error("Error tracking promo click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // Get promo analytics (contractor only)
  app.get("/api/contractor-promos/:promoId/analytics", isAuthenticated, isContractor, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error fetching promo analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Get active promos in area (public)
  app.get("/api/promos/area/:countyFips", async (req: any, res) => {
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
    } catch (error) {
      console.error("Error fetching area promos:", error);
      res.status(500).json({ message: "Failed to fetch area promos" });
    }
  });

  // One-tap bug report with screenshot
  app.post("/api/bug-reports", async (req: any, res) => {
    try {
      const { title, description, screenshot, userAgent, url, timestamp, viewport, type } = req.body;

      // Generate unique report ID
      const reportId = `BUG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Track bug report submission with locality
      await LocalityTracker.trackInteraction('page_view', req, {
        searchQuery: 'bug_report_submission',
        projectType: 'user_feedback'
      });

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
        description: description || 'Automatically generated bug report with screenshot',
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
    } catch (error) {
      console.error("Error processing bug report:", error);
      res.status(500).json({ message: "Failed to process bug report" });
    }
  });

  app.get("/api/admin/error-reports", isAuthenticated, async (req: any, res) => {
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
          description: "When I try to access the contractor dashboard on my phone, the page gets stuck loading and never shows content.",
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
          description: "The location filter on the contractor board doesn't seem to work. I select a county but all contractors still show up.",
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
    } catch (error) {
      console.error("Error fetching error reports:", error);
      res.status(500).json({ message: "Failed to fetch error reports" });
    }
  });

  app.patch("/api/admin/error-reports/:id", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error updating error report:", error);
      res.status(500).json({ message: "Failed to update error report" });
    }
  });

  // Testing settings endpoints
  app.get("/api/admin/testing-settings", async (req, res) => {
    res.json({
      bugReportEnabled: true,
      testingModeEnabled: false,
      showTestingBanner: false
    });
  });

  app.patch("/api/admin/testing-settings", async (req, res) => {
    res.json({ message: "Settings updated successfully" });
  });

  app.get("/api/admin/error-report-stats", async (req, res) => {
    res.json({
      total: 8,
      open: 3,
      inProgress: 2,
      resolved: 3
    });
  });

  app.post("/api/admin/generate-test-data", async (req, res) => {
    res.json({ message: "Test data generated successfully" });
  });

  app.delete("/api/admin/clear-test-data", async (req, res) => {
    res.json({ message: "Test data cleared successfully" });
  });

  // Marketplace routes
  // Categories
  app.get("/api/marketplace/categories", async (req, res) => {
    try {
      const categories = await storage.getMarketplaceCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching marketplace categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/marketplace/categories", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validatedData = insertMarketplaceCategorySchema.parse(req.body);
      const category = await storage.createMarketplaceCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating marketplace category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // Listings (public - only shows approved listings)
  app.get("/api/marketplace/listings", async (req, res) => {
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
    } catch (error) {
      console.error("Error fetching marketplace listings:", error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });

  app.get("/api/marketplace/listings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const listing = await storage.getMarketplaceListing(id);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Increment view count
      await storage.incrementListingView(id);

      res.json(listing);
    } catch (error) {
      console.error("Error fetching marketplace listing:", error);
      res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

  app.get("/api/marketplace/listings/slug/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const listing = await storage.getMarketplaceListingBySlug(slug);

      if (!listing) {
        return res.status(404).json({ message: "Listing not found" });
      }

      // Increment view count
      await storage.incrementListingView(listing.id);

      res.json(listing);
    } catch (error) {
      console.error("Error fetching marketplace listing by slug:", error);
      res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

  app.post("/api/marketplace/listings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertMarketplaceListingSchema.parse(req.body);

      // All new listings require admin/moderator approval before going live
      const listing = await storage.createMarketplaceListing({
        ...validatedData,
        sellerId: user.id,
        status: 'pending_approval', // Require approval for all new listings
      });

      res.status(201).json({
        ...listing,
        message: "Listing submitted successfully and is pending admin approval."
      });
    } catch (error) {
      console.error("Error creating marketplace listing:", error);
      res.status(400).json({ message: "Failed to create listing" });
    }
  });

  app.put("/api/marketplace/listings/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the listing
      const existingListing = await storage.getMarketplaceListing(id);
      if (!existingListing || existingListing.sellerId !== user.id) {
        return res.status(403).json({ message: "Not authorized to edit this listing" });
      }

      const updates = req.body;
      const listing = await storage.updateMarketplaceListing(id, updates);
      res.json(listing);
    } catch (error) {
      console.error("Error updating marketplace listing:", error);
      res.status(400).json({ message: "Failed to update listing" });
    }
  });

  app.delete("/api/marketplace/listings/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the listing or is admin
      const existingListing = await storage.getMarketplaceListing(id);
      if (!existingListing || (existingListing.sellerId !== user.id && !['head_admin', 'moderator', 'ops_admin'].includes(user.role || ''))) {
        return res.status(403).json({ message: "Not authorized to delete this listing" });
      }

      await storage.deleteMarketplaceListing(id);
      res.json({ message: "Listing deleted successfully" });
    } catch (error) {
      console.error("Error deleting marketplace listing:", error);
      res.status(500).json({ message: "Failed to delete listing" });
    }
  });

  // Admin/Moderator endpoints for listing approval

  // Get all pending listings for admin review
  app.get("/api/admin/marketplace/pending", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const filters = {
        status: 'pending_approval',
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      };

      const listings = await storage.getMarketplaceListings(filters);
      res.json(listings);
    } catch (error) {
      console.error("Error fetching pending listings:", error);
      res.status(500).json({ message: "Failed to fetch pending listings" });
    }
  });

  // Approve a listing
  app.post("/api/admin/marketplace/listings/:id/approve", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const { notes } = req.body;

      const listing = await storage.updateMarketplaceListing(id, {
        status: 'active',
        approvedBy: user.id,
        approvedAt: new Date(),
        moderationNotes: notes,
      });

      res.json({ 
        message: "Listing approved successfully",
        listing 
      });
    } catch (error) {
      console.error("Error approving listing:", error);
      res.status(400).json({ message: "Failed to approve listing" });
    }
  });

  // Reject a listing
  app.post("/api/admin/marketplace/listings/:id/reject", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const { reason, notes } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const listing = await storage.updateMarketplaceListing(id, {
        status: 'rejected',
        rejectedBy: user.id,
        rejectedAt: new Date(),
        rejectionReason: reason,
        moderationNotes: notes,
      });

      res.json({ 
        message: "Listing rejected successfully",
        listing 
      });
    } catch (error) {
      console.error("Error rejecting listing:", error);
      res.status(400).json({ message: "Failed to reject listing" });
    }
  });

  // User's own listings
  app.get("/api/marketplace/my-listings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const listings = await storage.getUserListings(user.id);
      res.json(listings);
    } catch (error) {
      console.error("Error fetching user listings:", error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });

  // Inquiries
  app.post("/api/marketplace/inquiries", isAuthenticated, async (req, res) => {
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
        buyerId: user.id,
        sellerId: listing.sellerId,
      });

      res.status(201).json(inquiry);
    } catch (error) {
      console.error("Error creating marketplace inquiry:", error);
      res.status(400).json({ message: "Failed to create inquiry" });
    }
  });

  app.get("/api/marketplace/inquiries/sent", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const inquiries = await storage.getUserInquiries(user.id, 'sent');
      res.json(inquiries);
    } catch (error) {
      console.error("Error fetching sent inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  app.get("/api/marketplace/inquiries/received", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const inquiries = await storage.getUserInquiries(user.id, 'received');
      res.json(inquiries);
    } catch (error) {
      console.error("Error fetching received inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  app.get("/api/marketplace/listings/:id/inquiries", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the listing
      const listing = await storage.getMarketplaceListing(id);
      if (!listing || listing.sellerId !== user.id) {
        return res.status(403).json({ message: "Not authorized to view inquiries for this listing" });
      }

      const inquiries = await storage.getListingInquiries(id);
      res.json(inquiries);
    } catch (error) {
      console.error("Error fetching listing inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  app.put("/api/marketplace/inquiries/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      // Check if user owns the inquiry (seller side)
      const inquiry = await storage.getMarketplaceInquiry(id);
      if (!inquiry || inquiry.sellerId !== user.id) {
        return res.status(403).json({ message: "Not authorized to update this inquiry" });
      }

      const updates = req.body;
      const updatedInquiry = await storage.updateMarketplaceInquiry(id, updates);
      res.json(updatedInquiry);
    } catch (error) {
      console.error("Error updating marketplace inquiry:", error);
      res.status(400).json({ message: "Failed to update inquiry" });
    }
  });

  // Favorites
  app.post("/api/marketplace/favorites", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertMarketplaceFavoriteSchema.parse(req.body);

      const favorite = await storage.createMarketplaceFavorite({
        ...validatedData,
        userId: user.id,
      });

      res.status(201).json(favorite);
    } catch (error) {
      console.error("Error creating marketplace favorite:", error);
      res.status(400).json({ message: "Failed to add to favorites" });
    }
  });

  app.delete("/api/marketplace/favorites/:listingId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { listingId } = req.params;

      await storage.removeMarketplaceFavorite(user.id, listingId);
      res.json({ message: "Removed from favorites" });
    } catch (error) {
      console.error("Error removing marketplace favorite:", error);
      res.status(500).json({ message: "Failed to remove from favorites" });
    }
  });

  app.get("/api/marketplace/favorites", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const favorites = await storage.getUserFavorites(user.id);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching marketplace favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Reports
  app.post("/api/marketplace/reports", async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertMarketplaceReportSchema.parse(req.body);

      const report = await storage.createMarketplaceReport({
        ...validatedData,
        reporterId: user?.id || null,
      });

      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating marketplace report:", error);
      res.status(400).json({ message: "Failed to create report" });
    }
  });

  app.get("/api/marketplace/admin/reports", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const reports = await storage.getMarketplaceReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching marketplace reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.put("/api/marketplace/admin/reports/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const report = await storage.updateMarketplaceReport(id, updates);
      res.json(report);
    } catch (error) {
      console.error("Error updating marketplace report:", error);
      res.status(400).json({ message: "Failed to update report" });
    }
  });

  // Marketplace Verification Endpoints
  app.post("/api/marketplace/vendor-verification", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertVendorVerificationSchema.parse(req.body);

      const verification = await storage.createVendorVerification({
        ...validatedData,
        userId: user.id,
      });

      res.status(201).json(verification);
    } catch (error) {
      console.error("Error creating vendor verification:", error);
      res.status(400).json({ message: "Failed to create vendor verification" });
    }
  });

  app.post("/api/marketplace/buyer-verification", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertBuyerVerificationSchema.parse(req.body);

      const verification = await storage.createBuyerVerification({
        ...validatedData,
        userId: user.id,
      });

      res.status(201).json(verification);
    } catch (error) {
      console.error("Error creating buyer verification:", error);
      res.status(400).json({ message: "Failed to create buyer verification" });
    }
  });

  app.get("/api/marketplace/verification/status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;

      const vendorVerification = await storage.getVendorVerificationByUserId(user.id);
      const buyerVerification = await storage.getBuyerVerificationByUserId(user.id);

      res.json({
        vendor: vendorVerification || null,
        buyer: buyerVerification || null,
        isVendorVerified: vendorVerification?.status === 'approved',
        isBuyerVerified: buyerVerification?.status === 'approved'
      });
    } catch (error) {
      console.error("Error fetching verification status:", error);
      res.status(500).json({ message: "Failed to fetch verification status" });
    }
  });

  app.get("/api/marketplace/admin/verifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { type = 'all', status = 'all' } = req.query;

      const verifications = await storage.getVerifications({
        type: type as string,
        status: status as string
      });

      res.json(verifications);
    } catch (error) {
      console.error("Error fetching verifications:", error);
      res.status(500).json({ message: "Failed to fetch verifications" });
    }
  });

  app.put("/api/marketplace/admin/verifications/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      const user = req.user as any;

      const updates = {
        status,
        adminNotes,
        reviewedBy: user.id,
        reviewedAt: new Date()
      };

      const verification = await storage.updateVerification(id, updates);
      res.json(verification);
    } catch (error) {
      console.error("Error updating verification:", error);
      res.status(400).json({ message: "Failed to update verification" });
    }
  });

  // Address Verification Endpoints
  app.post("/api/address-verification", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertAddressVerificationSchema.parse(req.body);

      // Calculate deadline (14 days from user creation)
      const userCreatedAt = new Date(user.createdAt);
      const deadline = new Date(userCreatedAt);
      deadline.setDate(deadline.getDate() + 14);

      const verification = await storage.createAddressVerification({
        ...validatedData,
        userId: user.id,
        deadline
      });

      res.status(201).json(verification);
    } catch (error) {
      console.error("Error creating address verification:", error);
      res.status(400).json({ message: "Failed to create address verification" });
    }
  });

  app.get("/api/address-verification/status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const verification = await storage.getAddressVerificationByUserId(user.id);

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
    } catch (error) {
      console.error("Error fetching address verification status:", error);
      res.status(500).json({ message: "Failed to fetch verification status" });
    }
  });

  app.post("/api/address-verification/postcard/request", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;

      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      await storage.sendAddressVerificationPostcard(user.id, code);

      // In a real implementation, you would send the postcard via USPS API
      console.log(`Postcard verification code for ${user.id}: ${code}`);

      res.json({ 
        message: "Verification postcard has been sent to your address. It should arrive within 5-7 business days.",
        estimatedDelivery: "5-7 business days"
      });
    } catch (error) {
      console.error("Error requesting postcard verification:", error);
      res.status(500).json({ message: "Failed to request postcard verification" });
    }
  });

  app.post("/api/address-verification/postcard/verify", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { code } = req.body;

      if (!code || code.length !== 6) {
        return res.status(400).json({ message: "Valid 6-digit code is required" });
      }

      const success = await storage.verifyAddressWithPostcard(user.id, code);

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
    } catch (error) {
      console.error("Error verifying postcard code:", error);
      res.status(500).json({ message: "Failed to verify postcard code" });
    }
  });

  app.put("/api/address-verification/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const updates = req.body;

      // Verify the user owns this verification
      const existingVerification = await storage.getAddressVerificationByUserId(user.id);
      if (!existingVerification || existingVerification.id !== id) {
        return res.status(403).json({ message: "Not authorized to update this verification" });
      }

      const verification = await storage.updateAddressVerification(id, {
        ...updates,
        submittedAt: new Date(),
        status: 'submitted'
      });

      res.json(verification);
    } catch (error) {
      console.error("Error updating address verification:", error);
      res.status(400).json({ message: "Failed to update verification" });
    }
  });

  // Admin endpoints for address verification
  app.get("/api/admin/address-verifications", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { status = 'all' } = req.query;

      let query = db.select({
        verification: addressVerifications,
        user: users
      })
      .from(addressVerifications)
      .leftJoin(users, eq(addressVerifications.userId, users.id));

      if (status !== 'all') {
        query = query.where(eq(addressVerifications.status, status as string)) as any;
      }

      const results = await query.orderBy(desc(addressVerifications.createdAt));

      res.json(results);
    } catch (error) {
      console.error("Error fetching address verifications:", error);
      res.status(500).json({ message: "Failed to fetch verifications" });
    }
  });

  app.put("/api/admin/address-verifications/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      const user = req.user as any;

      const updates: any = {
        status,
        adminNotes,
        reviewedBy: user.id,
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
    } catch (error) {
      console.error("Error updating address verification:", error);
      res.status(400).json({ message: "Failed to update verification" });
    }
  });

  // Social Features API Routes

  // Community Posts
  app.get("/api/community/posts", async (req, res) => {
    try {
      const filters = {
        scope: req.query.scope as string,
        stateCode: req.query.stateCode as string,
        countyFips: req.query.countyFips as string,
        category: req.query.category as string,
        authorId: req.query.authorId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const posts = await storage.getCommunityPosts(filters);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching community posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.post("/api/community/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { title, content, category, scope, stateCode, countyFips, images } = req.body;

      const newPost = await storage.createCommunityPost({
        title,
        content,
        category,
        scope,
        stateCode,
        countyFips,
        images,
        authorId: userId,
        isPublished: true,
        isHidden: false,
        likeCount: 0,
        commentCount: 0
      });

      res.status(201).json(newPost);
    } catch (error) {
      console.error("Error creating community post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  app.get("/api/community/posts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const post = await storage.getCommunityPost(id);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      res.json(post);
    } catch (error) {
      console.error("Error fetching community post:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  // Post Interactions
  app.post("/api/community/posts/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { id: postId } = req.params;

      const result = await storage.togglePostLike(userId, postId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling post like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  app.post("/api/community/posts/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { id: postId } = req.params;
      const { content } = req.body;

      const comment = await storage.createPostComment({
        postId,
        authorId: userId,
        content,
        isHidden: false
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.get("/api/community/posts/:id/comments", async (req, res) => {
    try {
      const { id: postId } = req.params;
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching post comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Community Groups
  app.get("/api/community/groups", async (req, res) => {
    try {
      const filters = {
        scope: req.query.scope as string,
        stateCode: req.query.stateCode as string,
        countyFips: req.query.countyFips as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const groups = await storage.getCommunityGroups(filters);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching community groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  // Regions
  app.get("/api/regions", async (req, res) => {
    try {
      const filters = {
        stateCode: req.query.stateCode as string,
        isOfficial: req.query.isOfficial === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const regions = await storage.getRegions(filters);
      res.json(regions);
    } catch (error) {
      console.error("Error fetching regions:", error);
      res.status(500).json({ message: "Failed to fetch regions" });
    }
  });

  // Handmade Marketplace Routes

  // Categories
  app.get("/api/handmade/categories", async (req, res) => {
    try {
      const categories = await storage.getHandmadeCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching handmade categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Products
  app.get("/api/handmade/products", async (req, res) => {
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
    } catch (error) {
      console.error("Error fetching handmade products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/handmade/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getHandmadeProduct(id);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Increment view count
      await storage.incrementProductViews(id);

      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/handmade/products", isAuthenticated, requireAddressVerification, async (req, res) => {
    try {
      const userId = req.user?.id;
      const productData = {
        ...req.body,
        sellerId: userId,
      };

      const product = await storage.createHandmadeProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/handmade/products/:id", isAuthenticated, requireAddressVerification, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Check if user owns the product
      const product = await storage.getHandmadeProduct(id);
      if (!product || product.sellerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updatedProduct = await storage.updateHandmadeProduct(id, req.body);
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // Product Favorites
  app.post("/api/handmade/products/:id/favorite", isAuthenticated, requireAddressVerification, async (req, res) => {
    try {
      const { id: productId } = req.params;
      const userId = req.user?.id;

      const result = await storage.toggleProductFavorite(userId, productId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      res.status(500).json({ message: "Failed to toggle favorite" });
    }
  });

  app.get("/api/handmade/favorites", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const favorites = await storage.getUserFavoriteProducts(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Product Orders
  app.post("/api/handmade/orders", isAuthenticated, requireAddressVerification, async (req, res) => {
    try {
      const userId = req.user?.id;
      const orderData = {
        ...req.body,
        buyerId: userId,
      };

      const order = await storage.createProductOrder(orderData);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.get("/api/handmade/orders", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const type = req.query.type as 'buyer' | 'seller' || 'buyer';

      const orders = await storage.getUserOrders(userId, type);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get("/api/handmade/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const order = await storage.getProductOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user is buyer or seller
      if (order.buyerId !== userId && order.sellerId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  app.put("/api/handmade/orders/:id", isAuthenticated, requireAddressVerification, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

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
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // Product Reviews
  app.post("/api/handmade/reviews", isAuthenticated, requireAddressVerification, async (req, res) => {
    try {
      const userId = req.user?.id;
      const reviewData = {
        ...req.body,
        buyerId: userId,
      };

      const review = await storage.createProductReview(reviewData);
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.get("/api/handmade/products/:id/reviews", async (req, res) => {
    try {
      const { id: productId } = req.params;
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.get("/api/handmade/products/:id/rating", async (req, res) => {
    try {
      const { id: productId } = req.params;
      const rating = await storage.getProductRatingSummary(productId);
      res.json(rating);
    } catch (error) {
      console.error("Error fetching rating:", error);
      res.status(500).json({ message: "Failed to fetch rating" });
    }
  });

  // Seller Profiles
  app.get("/api/handmade/sellers/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const profile = await storage.getSellerProfile(userId);

      if (!profile) {
        return res.status(404).json({ message: "Seller profile not found" });
      }

      res.json(profile);
    } catch (error) {
      console.error("Error fetching seller profile:", error);
      res.status(500).json({ message: "Failed to fetch seller profile" });
    }
  });

  app.post("/api/handmade/seller-profile", isAuthenticated, requireAddressVerification, async (req, res) => {
    try {
      const userId = req.user?.id;
      const profileData = {
        ...req.body,
        userId,
      };

      const profile = await storage.createSellerProfile(profileData);
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating seller profile:", error);
      res.status(500).json({ message: "Failed to create seller profile" });
    }
  });

  app.put("/api/handmade/seller-profile", isAuthenticated, requireAddressVerification, async (req, res) => {
    try {
      const userId = req.user?.id;
      const profile = await storage.updateSellerProfile(userId, req.body);
      res.json(profile);
    } catch (error) {
      console.error("Error updating seller profile:", error);
      res.status(500).json({ message: "Failed to update seller profile" });
    }
  });

  app.get("/api/handmade/seller-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const profile = await storage.getSellerProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching seller profile:", error);
      res.status(500).json({ message: "Failed to fetch seller profile" });
    }
  });

  app.get("/api/handmade/sellers/:userId/products", async (req, res) => {
    try {
      const { userId } = req.params;
      const products = await storage.getSellerProducts(userId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching seller products:", error);
      res.status(500).json({ message: "Failed to fetch seller products" });
    }
  });

  app.get("/api/handmade/sellers/:userId/ratings", async (req, res) => {
    try {
      const { userId } = req.params;
      const ratings = await storage.getSellerRatings(userId);
      res.json(ratings);
    } catch (error) {
      console.error("Error fetching seller ratings:", error);
      res.status(500).json({ message: "Failed to fetch seller ratings" });
    }
  });

  // ===== COMMUNITY MODERATION API ROUTES =====

  // Report content for moderation
  app.post("/api/moderation/reports", isAuthenticated, requireAddressVerification, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error creating moderation report:", error);
      res.status(500).json({ message: "Failed to create report" });
    }
  });

  // Get moderation reports for a user's location
  app.get("/api/moderation/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const filters = {
        status: req.query.status as string,
        contentType: req.query.contentType as string,
        county: req.query.county as string || user.county,
        state: req.query.state as string || user.state,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const reports = await storage.getModerationReports(filters);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching moderation reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Get specific moderation report
  app.get("/api/moderation/reports/:reportId", isAuthenticated, async (req: any, res) => {
    try {
      const { reportId } = req.params;
      const report = await storage.getModerationReport(reportId);

      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }

      res.json(report);
    } catch (error) {
      console.error("Error fetching moderation report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // Vote on a moderation report
  app.post("/api/moderation/reports/:reportId/vote", isAuthenticated, requireAddressVerification, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error creating moderation vote:", error);

      if (error.message === 'User has already voted on this report') {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ message: "Failed to create vote" });
    }
  });

  // Get votes for a specific report
  app.get("/api/moderation/reports/:reportId/votes", isAuthenticated, async (req: any, res) => {
    try {
      const { reportId } = req.params;
      const votes = await storage.getReportVotes(reportId);
      res.json(votes);
    } catch (error) {
      console.error("Error fetching report votes:", error);
      res.status(500).json({ message: "Failed to fetch votes" });
    }
  });

  // Check if user can vote on a report
  app.get("/api/moderation/reports/:reportId/can-vote", isAuthenticated, async (req: any, res) => {
    try {
      const { reportId } = req.params;
      const userId = req.user?.claims?.sub;

      const canVote = await storage.canUserVoteOnReport(userId, reportId);
      res.json({ canVote });
    } catch (error) {
      console.error("Error checking vote eligibility:", error);
      res.status(500).json({ message: "Failed to check vote eligibility" });
    }
  });

  // Create moderation appeal
  app.post("/api/moderation/appeals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

      const appealData = {
        ...req.body,
        appellantId: userId,
      };

      const validatedAppeal = insertModerationAppealSchema.parse(appealData);
      const appeal = await storage.createModerationAppeal(validatedAppeal);

      res.json(appeal);
    } catch (error) {
      console.error("Error creating moderation appeal:", error);
      res.status(500).json({ message: "Failed to create appeal" });
    }
  });

  // Get user's moderation appeals
  app.get("/api/moderation/appeals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const appeals = await storage.getAppealsByUser(userId);
      res.json(appeals);
    } catch (error) {
      console.error("Error fetching moderation appeals:", error);
      res.status(500).json({ message: "Failed to fetch appeals" });
    }
  });

  // Get specific moderation appeal
  app.get("/api/moderation/appeals/:appealId", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error fetching moderation appeal:", error);
      res.status(500).json({ message: "Failed to fetch appeal" });
    }
  });

  // Get user's moderation reputation
  app.get("/api/moderation/reputation", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error fetching moderation reputation:", error);
      res.status(500).json({ message: "Failed to fetch reputation" });
    }
  });

  // Get moderation actions for content
  app.get("/api/moderation/actions/:contentType/:contentId", isAuthenticated, async (req: any, res) => {
    try {
      const { contentType, contentId } = req.params;
      const actions = await storage.getModerationActions(contentType, contentId);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching moderation actions:", error);
      res.status(500).json({ message: "Failed to fetch actions" });
    }
  });

  // Get moderation settings for location
  app.get("/api/moderation/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const settings = await storage.getModerationSettings(user.county, user.state);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching moderation settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Invitation System API Routes

  // Send email invitation
  app.post("/api/invitations/send", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { email, targetRole, personalMessage } = req.body;

      // Validate required fields
      if (!email || !targetRole) {
        return res.status(400).json({ message: "Email and target role are required" });
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
        code: invitationCode,
        email,
        targetRole,
        personalMessage: personalMessage || null,
        invitedBy: userId,
        status: 'pending'
      });

      // Update user's referral stats
      await storage.incrementInvitationsSent(userId);

      // TODO: Send email notification (when email service is setup)

      res.status(201).json(invitation);
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get user's invitations
  app.get("/api/invitations/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const invitations = await storage.getUserInvitations(userId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Accept invitation (public endpoint)
  app.post("/api/invitations/accept/:code", async (req, res) => {
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
      if (invitation.invitedBy) {
        await storage.incrementInvitationsAccepted(
          invitation.invitedBy, 
          invitation.targetRole as 'homeowner' | 'contractor_user'
        );
      }

      res.json(acceptedInvitation);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Validate invitation code (public endpoint for signup page)
  app.get("/api/invitations/validate/:code", async (req, res) => {
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
        email: invitation.email,
        targetRole: invitation.targetRole,
        personalMessage: invitation.personalMessage
      });
    } catch (error) {
      console.error("Error validating invitation:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  // Generate or get user's referral code
  app.post("/api/referrals/generate-code", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  // Get user's referral stats
  app.get("/api/referrals/stats", isAuthenticated, async (req: any, res) => {
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
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Get top referrers leaderboard
  app.get("/api/referrals/leaderboard", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topReferrers = await storage.getTopReferrers(limit);
      res.json(topReferrers);
    } catch (error) {
      console.error("Error fetching referral leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Cleanup expired invitations (internal endpoint)
  app.post("/api/invitations/cleanup", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.expireOldInvitations();
      res.json({ message: "Expired invitations cleaned up successfully" });
    } catch (error) {
      console.error("Error cleaning up invitations:", error);
      res.status(500).json({ message: "Failed to cleanup invitations" });
    }
  });

  // Professional Network Applications

  // Realtor application submission
  app.post("/api/realtor/application", isAuthenticated, requireAddressVerification, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;

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
    } catch (error) {
      console.error("Error submitting realtor application:", error);
      res.status(500).json({ message: "Failed to submit realtor application" });
    }
  });

  // Car salesman application submission
  app.post("/api/car-salesman/application", isAuthenticated, requireAddressVerification, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;

      // Check if user already has a car salesman profile
      const existingProfile = await storage.getCarSalesmanProfile(userId);
      if (existingProfile) {
        return res.status(400).json({ message: "You already have a car salesman profile" });
      }

      const validatedData = insertCarSalesmanProfileSchema.parse(req.body);
      const carSalesmanProfile = await storage.createCarSalesmanProfile(validatedData);

      // Update user role to car_salesman
      await storage.updateUserRole(userId, 'car_salesman');

      await storage.logEvent('car_salesman_application_submitted', {
        profileId: carSalesmanProfile.id,
        userId,
      });

      res.json({ 
        message: "Car salesman application submitted successfully", 
        profileId: carSalesmanProfile.id 
      });
    } catch (error) {
      console.error("Error submitting car salesman application:", error);
      res.status(500).json({ message: "Failed to submit car salesman application" });
    }
  });

  // Professional verification endpoints for admins
  app.get("/api/admin/professional/pending", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const pendingRealtors = await storage.getPendingRealtorApplications();
      const pendingCarSalesmen = await storage.getPendingCarSalesmanApplications();

      res.json({
        realtors: pendingRealtors,
        carSalesmen: pendingCarSalesmen
      });
    } catch (error) {
      console.error("Error fetching pending applications:", error);
      res.status(500).json({ message: "Failed to fetch pending applications" });
    }
  });

  app.post("/api/admin/realtor/verify/:profileId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { profileId } = req.params;
      const { approved, notes } = req.body;
      const adminId = (req.user as any)?.claims?.sub || req.user?.id;

      const result = await storage.updateRealtorVerificationStatus(
        profileId, 
        approved ? 'approved' : 'rejected',
        adminId,
        notes
      );

      await storage.logEvent('realtor_verification_decision', {
        profileId,
        adminId,
        approved,
        notes
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating realtor verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  app.post("/api/admin/car-salesman/verify/:profileId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { profileId } = req.params;
      const { approved, notes } = req.body;
      const adminId = (req.user as any)?.claims?.sub || req.user?.id;

      const result = await storage.updateCarSalesmanVerificationStatus(
        profileId, 
        approved ? 'approved' : 'rejected',
        adminId,
        notes
      );

      await storage.logEvent('car_salesman_verification_decision', {
        profileId,
        adminId,
        approved,
        notes
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating car salesman verification:", error);
      res.status(500).json({ message: "Failed to update verification status" });
    }
  });

  // ==================== AFFILIATE SYSTEM ROUTES ====================

  // Create or get affiliate program for user
  app.post("/api/affiliate/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

      // Check if user already has an affiliate program
      const existingProgram = await storage.getAffiliateProgram(userId);
      if (existingProgram) {
        return res.json(existingProgram);
      }

      // Generate unique affiliate code
      const affiliateCode = await storage.generateAffiliateCode(userId);

      // Create new affiliate program
      const program = await storage.createAffiliateProgram({
        userId,
        affiliateCode,
        commissionRate: '25.00', // 25% commission rate
        status: 'active',
        referralLink: `${req.protocol}://${req.get('host')}?ref=${affiliateCode}`,
        totalCommissionEarned: '0',
        totalCommissionPaid: '0'
      });

      res.status(201).json(program);
    } catch (error) {
      console.error("Error joining affiliate program:", error);
      res.status(500).json({ message: "Failed to join affiliate program" });
    }
  });

  // Get affiliate dashboard data
  app.get("/api/affiliate/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

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
        program,
        stats,
        referrals: referrals.slice(0, 10), // Last 10 referrals
        commissions: commissions.slice(0, 10), // Last 10 commissions
        payouts: payouts.slice(0, 5) // Last 5 payouts
      });
    } catch (error) {
      console.error("Error fetching affiliate dashboard:", error);
      res.status(500).json({ message: "Failed to fetch affiliate dashboard" });
    }
  });

  // Track referral click (public endpoint)
  app.post("/api/affiliate/track-click", async (req: any, res) => {
    try {
      const { affiliateCode, sourceUrl, utm } = req.body;

      if (!affiliateCode) {
        return res.status(400).json({ message: "Affiliate code is required" });
      }

      // Find affiliate program by code
      const programs = await db
        .select()
        .from(affiliatePrograms)
        .where(eq(affiliatePrograms.affiliateCode, affiliateCode))
        .limit(1);

      const program = programs[0];
      if (!program) {
        return res.status(404).json({ message: "Invalid affiliate code" });
      }

      // Track the referral click
      const referral = await storage.trackReferralClick({
        affiliateProgramId: program.id,
        affiliateCode,
        sourceUrl: sourceUrl || req.get('Referer'),
        utmSource: utm?.source,
        utmMedium: utm?.medium,
        utmCampaign: utm?.campaign,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        status: 'clicked'
      });

      res.json({ success: true, referralId: referral.id });
    } catch (error) {
      console.error("Error tracking referral click:", error);
      res.status(500).json({ message: "Failed to track referral" });
    }
  });

  // Convert referral when user signs up
  app.post("/api/affiliate/convert", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { affiliateCode } = req.body;

      if (!affiliateCode) {
        return res.status(400).json({ message: "Affiliate code is required" });
      }

      // Convert the referral
      await storage.convertReferral(affiliateCode, userId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error converting referral:", error);
      res.status(500).json({ message: "Failed to convert referral" });
    }
  });

  // Process commission (internal use - called when revenue is generated)
  app.post("/api/affiliate/commission", isAuthenticated, async (req: any, res) => {
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
        description: description || 'Commission earned',
        status: 'pending'
      });

      res.status(201).json(commission);
    } catch (error) {
      console.error("Error creating commission:", error);
      res.status(500).json({ message: "Failed to create commission" });
    }
  });

  // Get referrals for affiliate
  app.get("/api/affiliate/referrals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const referrals = await storage.getReferralsByAffiliate(program.id);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // Get commissions for affiliate
  app.get("/api/affiliate/commissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const commissions = await storage.getCommissionsForAffiliate(program.id);
      res.json(commissions);
    } catch (error) {
      console.error("Error fetching commissions:", error);
      res.status(500).json({ message: "Failed to fetch commissions" });
    }
  });

  // Get payouts for affiliate
  app.get("/api/affiliate/payouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const payouts = await storage.getPayoutsForAffiliate(program.id);
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  // Admin: Approve commission
  app.put("/api/admin/affiliate/commissions/:commissionId/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      // Check admin permissions
      if (!user || !['ops_admin', 'head_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { commissionId } = req.params;
      await storage.approveCommission(commissionId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error approving commission:", error);
      res.status(500).json({ message: "Failed to approve commission" });
    }
  });

  // Admin: Create payout
  app.post("/api/admin/affiliate/payouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      // Check admin permissions
      if (!user || !['ops_admin', 'head_admin'].includes(user.role)) {
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
    } catch (error) {
      console.error("Error creating payout:", error);
      res.status(500).json({ message: "Failed to create payout" });
    }
  });

  // Admin: Update payout status
  app.put("/api/admin/affiliate/payouts/:payoutId/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      // Check admin permissions
      if (!user || !['ops_admin', 'head_admin'].includes(user.role)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { payoutId } = req.params;
      const { status } = req.body;

      if (!status || !['pending', 'processing', 'completed', 'failed'].includes(status)) {
        return res.status(400).json({ message: "Valid status is required" });
      }

      await storage.updatePayoutStatus(payoutId, status);

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating payout status:", error);
      res.status(500).json({ message: "Failed to update payout status" });
    }
  });

  // Update affiliate program settings
  app.put("/api/affiliate/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;

      const program = await storage.getAffiliateProgram(userId);
      if (!program) {
        return res.status(404).json({ message: "Affiliate program not found" });
      }

      const { payoutMethod, payoutDetails } = req.body;

      const updatedProgram = await storage.updateAffiliateProgram(program.id, {
        payoutMethod,
        payoutDetails
      });

      res.json(updatedProgram);
    } catch (error) {
      console.error("Error updating affiliate settings:", error);
      res.status(500).json({ message: "Failed to update affiliate settings" });
    }
  });

  // Initialize WebSocket server
  // Tutorial Management Routes
  app.get("/api/tutorials/user-progress", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const progress = await tutorialStorage.getUserTutorialProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching tutorial progress:", error);
      res.status(500).json({ message: "Failed to fetch tutorial progress" });
    }
  });

  app.get("/api/tutorials/recommended", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role || 'homeowner';

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const recommended = await tutorialStorage.getRecommendedTutorialsForUser(userId, userRole);
      res.json(recommended);
    } catch (error) {
      console.error("Error fetching recommended tutorials:", error);
      res.status(500).json({ message: "Failed to fetch recommended tutorials" });
    }
  });

  app.get("/api/tutorials/:tutorialId", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { tutorialId } = req.params;
      const tutorial = await tutorialStorage.getTutorialById(tutorialId);

      if (!tutorial) {
        return res.status(404).json({ message: "Tutorial not found" });
      }

      res.json(tutorial);
    } catch (error) {
      console.error("Error fetching tutorial:", error);
      res.status(500).json({ message: "Failed to fetch tutorial" });
    }
  });

  app.post("/api/tutorials/:tutorialId/start", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
    } catch (error) {
      console.error("Error starting tutorial:", error);
      res.status(500).json({ message: "Failed to start tutorial" });
    }
  });

  app.put("/api/tutorials/:tutorialId/progress", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
    } catch (error) {
      console.error("Error updating tutorial progress:", error);
      res.status(500).json({ message: "Failed to update tutorial progress" });
    }
  });

  app.post("/api/tutorials/:tutorialId/complete", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
    } catch (error) {
      console.error("Error completing tutorial:", error);
      res.status(500).json({ message: "Failed to complete tutorial" });
    }
  });

  app.post("/api/tutorials/:tutorialId/skip", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
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
    } catch (error) {
      console.error("Error skipping tutorial:", error);
      res.status(500).json({ message: "Failed to skip tutorial" });
    }
  });

  app.get("/api/tutorials/check/:featureId", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.id;
      const { featureId } = req.params;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const shouldShow = await tutorialStorage.shouldShowTutorial(userId, featureId);
      const tutorial = shouldShow ? await tutorialStorage.getTutorialById(featureId) : null;

      res.json({ shouldShow, tutorial });
    } catch (error) {
      console.error("Error checking tutorial:", error);
      res.status(500).json({ message: "Failed to check tutorial" });
    }
  });

  // Initialize default tutorials on server start
  tutorialStorage.initializeDefaultTutorials().catch(console.error);

  const httpServer = createServer(app);
  const wsManager = new WebSocketManager(httpServer);

  // Advanced marketplace transaction routes

  // Create payment intent for marketplace purchase
  app.post("/api/create-payment-intent", isAuthenticated, async (req, res) => {
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

      const platformFee = Math.round(listing.price * 0.05 * 100); // 5% platform fee in cents
      const totalAmount = Math.round(listing.price * 100) + platformFee; // Total in cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: "usd",
        metadata: {
          listingId: listing.id,
          sellerId: listing.sellerId,
          buyerId: (req.user as any)?.claims?.sub || req.user?.id,
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
  app.post("/api/marketplace/transactions", isAuthenticated, async (req, res) => {
    try {
      const transactionData = {
        ...req.body,
        buyerId: (req.user as any)?.claims?.sub || req.user?.id,
      };

      const transaction = await storage.createMarketplaceTransaction(transactionData);

      // Send notifications to both buyer and seller
      const sellerNotification = {
        userId: transaction.sellerId,
        type: 'transaction',
        title: 'New Purchase',
        message: `Someone purchased your item for $${transaction.totalAmount}`,
        actionUrl: `/transactions/${transaction.id}`,
      };

      const buyerNotification = {
        userId: transaction.buyerId,
        type: 'transaction',
        title: 'Purchase Confirmed',
        message: `Your purchase of $${transaction.totalAmount} has been confirmed`,
        actionUrl: `/transactions/${transaction.id}`,
      };

      await Promise.all([
        storage.createNotification(sellerNotification),
        storage.createNotification(buyerNotification),
      ]);

      // Send real-time notifications
      wsManager.sendNotificationToUser(transaction.sellerId, sellerNotification);
      wsManager.sendNotificationToUser(transaction.buyerId, buyerNotification);

      res.json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  // Get user transactions
  app.get("/api/marketplace/transactions", isAuthenticated, async (req, res) => {
    try {
      const { role = 'buyer' } = req.query;
      const userId = (req.user as any)?.claims?.sub || req.user?.id;

      const transactions = await storage.getMarketplaceTransactionsByUser(userId, role as 'buyer' | 'seller');
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Update transaction status
  app.put("/api/marketplace/transactions/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const transaction = await storage.updateMarketplaceTransaction(id, req.body);

      // Send real-time update
      wsManager.sendTransactionUpdate(transaction.buyerId, transaction);
      wsManager.sendTransactionUpdate(transaction.sellerId, transaction);

      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  // Create user review
  app.post("/api/reviews", isAuthenticated, async (req, res) => {
    try {
      const reviewData = {
        ...req.body,
        reviewerId: (req.user as any)?.claims?.sub || req.user?.id,
      };

      const review = await storage.createUserReview(reviewData);

      // Send notification to reviewee
      const notification = {
        userId: review.revieweeId,
        type: 'review',
        title: 'New Review Received',
        message: `You received a ${review.rating}-star review`,
        actionUrl: `/profile/reviews`,
      };

      await storage.createNotification(notification);
      wsManager.sendNotificationToUser(review.revieweeId, notification);

      res.json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Get user reviews
  app.get("/api/reviews/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { role = 'reviewee' } = req.query;

      const reviews = await storage.getUserReviews(userId, role as 'reviewer' | 'reviewee');
      const ratings = await storage.getUserRatings(userId);

      res.json({ reviews, ratings });
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  // Real-time notifications endpoints
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const { unreadOnly } = req.query;

      const notifications = await storage.getUserNotifications(userId, unreadOnly === 'true');
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id);
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Advanced search and discovery
  app.get("/api/marketplace/search", async (req, res) => {
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
          userId: (req.user as any)?.claims?.sub || req.user?.id,
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
      const searchResults = await storage.searchMarketplaceListings({
        query: query as string,
        category: category as string,
        minPrice: minPrice ? parseInt(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseInt(maxPrice as string) : undefined,
        location: location as string,
        condition: condition as string,
        verifiedOnly: verifiedOnly === 'true',
        freeShipping: freeShipping === 'true',
        buyerProtection: buyerProtection === 'true',
        sortBy: sortBy as string,
      });

      res.json(searchResults);
    } catch (error) {
      console.error("Error performing search:", error);
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // Saved searches
  app.post("/api/saved-searches", isAuthenticated, async (req, res) => {
    try {
      const searchData = {
        ...req.body,
        userId: (req.user as any)?.claims?.sub || req.user?.id,
      };

      const savedSearch = await storage.createSavedSearch(searchData);
      res.json(savedSearch);
    } catch (error) {
      console.error("Error saving search:", error);
      res.status(500).json({ message: "Failed to save search" });
    }
  });

  app.get("/api/saved-searches", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const savedSearches = await storage.getUserSavedSearches(userId);
      res.json(savedSearches);
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ message: "Failed to fetch saved searches" });
    }
  });

  app.delete("/api/saved-searches/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSavedSearch(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ message: "Failed to delete saved search" });
    }
  });

  // Transaction disputes
  app.post("/api/disputes", isAuthenticated, async (req, res) => {
    try {
      const disputeData = {
        ...req.body,
        initiatorId: (req.user as any)?.claims?.sub || req.user?.id,
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
    } catch (error) {
      console.error("Error creating dispute:", error);
      res.status(500).json({ message: "Failed to create dispute" });
    }
  });

  // ==================== PAYMENT SYSTEM ROUTES ====================

  // Payment methods and configurations
  app.get("/api/payments/methods", isAuthenticated, (req, res) => {
    try {
      const methods = paymentService.getAvailablePaymentMethods(true);
      res.json(methods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  // Create contractor payment intent
  app.post("/api/payments/contractor/create-intent", isAuthenticated, async (req: any, res) => {
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
      if (payment.homeownerId !== user.id && payment.contractorId !== user.id) {
        return res.status(403).json({ message: "Not authorized to access this payment" });
      }

      const result = await paymentService.createContractorPaymentIntent(payment);
      res.json(result);
    } catch (error) {
      console.error("Error creating contractor payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // Create marketplace payment intent
  app.post("/api/payments/marketplace/create-intent", isAuthenticated, async (req: any, res) => {
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
      if (transaction.buyerId !== user.id && transaction.sellerId !== user.id) {
        return res.status(403).json({ message: "Not authorized to access this transaction" });
      }

      const result = await paymentService.createMarketplacePaymentIntent(transaction);
      res.json(result);
    } catch (error) {
      console.error("Error creating marketplace payment intent:", error);
      res.status(500).json({ message: "Failed to create payment intent" });
    }
  });

  // Confirm off-platform payment
  app.post("/api/payments/confirm-off-platform", isAuthenticated, async (req: any, res) => {
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
          confirmedBy: user.id
        }
      );

      res.json(result);
    } catch (error) {
      console.error("Error confirming off-platform payment:", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // Get payment details
  app.get("/api/payments/contractor/:paymentId", isAuthenticated, async (req: any, res) => {
    try {
      const { paymentId } = req.params;
      const payment = await storage.getContractorPayment(paymentId);

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      // Verify user authorization
      const user = req.user;
      if (payment.homeownerId !== user.id && payment.contractorId !== user.id) {
        return res.status(403).json({ message: "Not authorized to access this payment" });
      }

      res.json(payment);
    } catch (error) {
      console.error("Error fetching contractor payment:", error);
      res.status(500).json({ message: "Failed to fetch payment" });
    }
  });

  app.get("/api/payments/marketplace/:transactionId", isAuthenticated, async (req: any, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await storage.getMarketplaceTransaction(transactionId);

      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Verify user authorization
      const user = req.user;
      if (transaction.buyerId !== user.id && transaction.sellerId !== user.id) {
        return res.status(403).json({ message: "Not authorized to access this transaction" });
      }

      res.json(transaction);
    } catch (error) {
      console.error("Error fetching marketplace transaction:", error);
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });

  // Get user payment history
  app.get("/api/payments/history", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const { type = 'all' } = req.query;

      const history: any = {};

      if (type === 'all' || type === 'contractor') {
        // Get contractor payments where user is homeowner
        const homeownerPayments = await storage.getContractorPaymentsByHomeowner(user.id);
        // Get contractor payments where user is contractor  
        const contractorPayments = await storage.getContractorPaymentsByContractor(user.id);
        history.contractorPayments = {
          asHomeowner: homeownerPayments,
          asContractor: contractorPayments
        };
      }

      if (type === 'all' || type === 'marketplace') {
        // Get marketplace transactions where user is buyer
        const buyerTransactions = await storage.getMarketplaceTransactionsByUser(user.id, 'buyer');
        // Get marketplace transactions where user is seller
        const sellerTransactions = await storage.getMarketplaceTransactionsByUser(user.id, 'seller');
        history.marketplaceTransactions = {
          asBuyer: buyerTransactions,
          asSeller: sellerTransactions
        };
      }

      res.json(history);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ message: "Failed to fetch payment history" });
    }
  });

  // Calculate payment fees
  app.post("/api/payments/calculate-fees", async (req, res) => {
    try {
      const { amount, paymentType = 'contractor_service' } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Valid amount required" });
      }

      const fees = await paymentService.calculatePaymentFees(amount, paymentType);
      res.json(fees);
    } catch (error) {
      console.error("Error calculating fees:", error);
      res.status(500).json({ message: "Failed to calculate fees" });
    }
  });

  // Stripe webhook endpoint
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      // In production, you should verify the webhook signature
      const event = req.body;

      await paymentService.handleStripeWebhook(event);
      res.json({ received: true });
    } catch (error) {
      console.error("Error handling webhook:", error);
      res.status(500).json({ message: "Webhook handler failed" });
    }
  });

  // Admin payment configuration routes
  app.get("/api/admin/payment-config", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { configType = 'contractor_service' } = req.query;
      const config = await storage.getPaymentConfiguration(configType as string);
      res.json(config || {});
    } catch (error) {
      console.error("Error fetching payment config:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.post("/api/admin/payment-config", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const configData = req.body;
      const config = await storage.createPaymentConfiguration(configData);
      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating payment config:", error);
      res.status(500).json({ message: "Failed to create configuration" });
    }
  });

  // ==================== FOUNDATION SYSTEM ROUTES ====================

  // Get foundation statistics
  app.get('/api/foundation/stats', async (req, res) => {
    try {
      const stats = await storage.getFoundationStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching foundation stats:', error);
      res.status(500).json({ message: 'Failed to fetch foundation statistics' });
    }
  });

  // Get foundation causes with filters
  app.get('/api/foundation/causes', async (req, res) => {
    try {
      const { category, countyId, isActive } = req.query;
      const filters = {
        category: category as string,
        countyId: countyId as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      };

      const causes = await storage.getFoundationCauses(filters);
      res.json(causes);
    } catch (error) {
      console.error('Error fetching foundation causes:', error);
      res.status(500).json({ message: 'Failed to fetch foundation causes' });
    }
  });

  // Get single foundation cause
  app.get('/api/foundation/causes/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const cause = await storage.getFoundationCause(id);

      if (!cause) {
        return res.status(404).json({ message: 'Cause not found' });
      }

      res.json(cause);
    } catch (error) {
      console.error('Error fetching foundation cause:', error);
      res.status(500).json({ message: 'Failed to fetch foundation cause' });
    }
  });

  // Create foundation donation
  app.post('/api/foundation/donate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const {
        causeId,
        amount,
        type = 'one_time',
        isAnonymous = false,
        donorMessage,
        isRoundupDonation = false,
        originalAmount,
        relatedTransactionId,
        relatedTransactionType
      } = req.body;

      // Validate required fields
      if (!causeId || !amount || amount < 1) {
        return res.status(400).json({ 
          message: 'Invalid donation data. Cause ID and minimum $1 amount required.' 
        });
      }

      // Verify cause exists
      const cause = await storage.getFoundationCause(causeId);
      if (!cause) {
        return res.status(404).json({ message: 'Cause not found' });
      }

      // Create Stripe payment intent for the donation
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          type: 'foundation_donation',
          causeId,
          userId,
          isRoundupDonation: isRoundupDonation.toString(),
          ...(originalAmount && { originalAmount: originalAmount.toString() })
        }
      });

      // Create donation record
      const donation = await storage.createFoundationDonation({
        userId,
        causeId,
        amount: amount.toString(),
        type: type as any,
        isAnonymous,
        donorMessage: donorMessage?.trim() || undefined,
        isRoundupDonation,
        originalAmount: originalAmount?.toString(),
        relatedTransactionId,
        relatedTransactionType,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending'
      });

      res.json({
        donationId: donation.id,
        clientSecret: paymentIntent.client_secret,
        message: 'Donation payment intent created successfully'
      });

    } catch (error) {
      console.error('Error creating donation:', error);
      res.status(500).json({ message: 'Failed to process donation' });
    }
  });

  // Handle donation payment success (webhook or confirmation)
  app.post('/api/foundation/donations/:id/confirm', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const { stripePaymentIntentId } = req.body;

      // Get and verify donation
      const donation = await storage.getFoundationDonation(id);
      if (!donation || donation.userId !== userId) {
        return res.status(404).json({ message: 'Donation not found' });
      }

      // Verify payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        // Update donation status
        const updatedDonation = await storage.updateFoundationDonation(id, {
          status: 'completed',
          completedAt: new Date(),
          stripeChargeId: paymentIntent.latest_charge as string,
          paymentMethod: paymentIntent.payment_method_types[0],
          processingFee: (paymentIntent.application_fee_amount || 0) / 100,
          netAmount: (paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) / 100
        });

        // Update cause raised amount
        await storage.updateCauseRaisedAmount(donation.causeId, Number(donation.amount));

        // Track affiliate commission for successful donation
        try {
          await paymentService.trackAffiliateCommission(
            userId,
            Number(donation.amount),
            'foundation_donation',
            donation.id
          );
        } catch (commissionError) {
          console.error('Error tracking affiliate commission for donation:', commissionError);
          // Don't fail the donation if commission tracking fails
        }

        res.json({
          donation: updatedDonation,
          message: 'Donation completed successfully'
        });
      } else {
        res.status(400).json({ message: 'Payment not successful' });
      }

    } catch (error) {
      console.error('Error confirming donation:', error);
      res.status(500).json({ message: 'Failed to confirm donation' });
    }
  });

  // Get user's donations
  app.get('/api/foundation/my-donations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const { status, type } = req.query;

      const filters = {
        status: status as string,
        type: type as string
      };

      const donations = await storage.getUserDonations(userId, filters);
      res.json(donations);
    } catch (error) {
      console.error('Error fetching user donations:', error);
      res.status(500).json({ message: 'Failed to fetch donations' });
    }
  });

  // Get/Update user donation preferences
  app.get('/api/foundation/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const preferences = await storage.getUserDonationPreferences(userId);
      res.json(preferences || {});
    } catch (error) {
      console.error('Error fetching donation preferences:', error);
      res.status(500).json({ message: 'Failed to fetch preferences' });
    }
  });

  app.put('/api/foundation/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      const preferences = await storage.upsertUserDonationPreferences(userId, req.body);
      res.json(preferences);
    } catch (error) {
      console.error('Error updating donation preferences:', error);
      res.status(500).json({ message: 'Failed to update preferences' });
    }
  });

  // Get recent donations (public feed)
  app.get('/api/foundation/recent-donations', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const donations = await storage.getRecentDonations(limit);
      res.json(donations);
    } catch (error) {
      console.error('Error fetching recent donations:', error);
      res.status(500).json({ message: 'Failed to fetch recent donations' });
    }
  });

  // Get foundation impact reports
  app.get('/api/foundation/impact-reports', async (req, res) => {
    try {
      const { causeId } = req.query;
      const reports = await storage.getFoundationImpactReports(causeId as string);
      res.json(reports);
    } catch (error) {
      console.error('Error fetching impact reports:', error);
      res.status(500).json({ message: 'Failed to fetch impact reports' });
    }
  });

  // Admin: Create foundation cause
  app.post('/api/admin/foundation/causes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;

      // Check admin permissions
      const user = await storage.getUser(userId);
      if (!user || !['head_admin', 'ops_admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const causeData = {
        ...req.body,
        createdBy: userId
      };

      const cause = await storage.createFoundationCause(causeData);
      res.json(cause);
    } catch (error) {
      console.error('Error creating foundation cause:', error);
      res.status(500).json({ message: 'Failed to create cause' });
    }
  });

  // Admin: Create impact report
  app.post('/api/admin/foundation/impact-reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;

      // Check admin permissions
      const user = await storage.getUser(userId);
      if (!user || !['head_admin', 'ops_admin'].includes(user.role)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const report = await storage.createFoundationImpactReport({
        ...req.body,
        publishedAt: new Date()
      });

      res.json(report);
    } catch (error) {
      console.error('Error creating impact report:', error);
      res.status(500).json({ message: 'Failed to create impact report' });
    }
  });

  // Data Privacy and Security Management Routes
  app.get("/api/user/privacy-settings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      await dataManagementService.logDataAccess({
        userId: user.id,
        accessorId: user.id,
        accessorRole: user.role,
        actionType: 'view',
        resourceType: 'profile',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const settings = await dataManagementService.getUserPrivacySettings(user.id);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching privacy settings:", error);
      res.status(500).json({ message: "Failed to fetch privacy settings" });
    }
  });

  app.put("/api/user/privacy-settings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      await dataManagementService.logDataAccess({
        userId: user.id,
        accessorId: user.id,
        accessorRole: user.role,
        actionType: 'edit',
        resourceType: 'profile',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const settings = await dataManagementService.updateUserPrivacySettings(user.id, req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      res.status(500).json({ message: "Failed to update privacy settings" });
    }
  });

  app.post("/api/user/data-export-request", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const request = await dataManagementService.createDataRequest({
        userId: user.id,
        requestType: 'data_export',
        reason: req.body.reason,
        requestedBy: user.id,
      });

      await dataManagementService.logDataAccess({
        userId: user.id,
        accessorId: user.id,
        accessorRole: user.role,
        actionType: 'export',
        resourceType: 'profile',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { requestId: request.id }
      });

      res.json({
        message: "Data export request created successfully.",
        requestId: request.id
      });
    } catch (error) {
      console.error("Error creating data export request:", error);
      res.status(500).json({ message: "Failed to create data export request" });
    }
  });

  app.post("/api/user/account-deletion-request", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const request = await dataManagementService.createDataRequest({
        userId: user.id,
        requestType: 'account_closure',
        reason: req.body.reason,
        requestedBy: user.id,
      });

      await dataManagementService.logDataAccess({
        userId: user.id,
        accessorId: user.id,
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
    } catch (error) {
      console.error("Error creating account deletion request:", error);
      res.status(500).json({ message: "Failed to create account deletion request" });
    }
  });

  // Admin Data Management Routes
  app.get("/api/admin/data-requests", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { status } = req.query;

      await dataManagementService.logDataAccess({
        accessorId: user.id,
        accessorRole: user.role,
        actionType: 'view',
        resourceType: 'analytics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const requests = await dataManagementService.getAllDataRequests(status as string);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching data requests:", error);
      res.status(500).json({ message: "Failed to fetch data requests" });
    }
  });

  app.post("/api/admin/process-data-export/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      const requests = await dataManagementService.getAllDataRequests();
      const request = requests.find(r => r.id === id);

      if (!request || request.requestType !== 'data_export') {
        return res.status(404).json({ message: "Data export request not found" });
      }

      await dataManagementService.logDataAccess({
        userId: request.userId,
        accessorId: user.id,
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

    } catch (error) {
      console.error("Error processing data export:", error);
      res.status(500).json({ message: "Failed to process data export" });
    }
  });

  app.post("/api/admin/approve-account-deletion/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;

      const requests = await dataManagementService.getAllDataRequests();
      const request = requests.find(r => r.id === id);

      if (!request || request.requestType !== 'account_closure') {
        return res.status(404).json({ message: "Account deletion request not found" });
      }

      await dataManagementService.deleteUserData(request.userId, user.id);

      res.json({ message: "Account successfully deleted" });

    } catch (error) {
      console.error("Error processing account deletion:", error);
      res.status(500).json({ message: "Failed to process account deletion" });
    }
  });

  app.get("/api/admin/security-incidents", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { status } = req.query;

      await dataManagementService.logDataAccess({
        accessorId: user.id,
        accessorRole: user.role,
        actionType: 'view',
        resourceType: 'analytics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const incidents = await dataManagementService.getSecurityIncidents(status as string);
      res.json(incidents);
    } catch (error) {
      console.error("Error fetching security incidents:", error);
      res.status(500).json({ message: "Failed to fetch security incidents" });
    }
  });

  app.get("/api/admin/user-access-logs/:userId", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const { userId } = req.params;
      const { limit = 100 } = req.query;

      await dataManagementService.logDataAccess({
        userId: userId,
        accessorId: user.id,
        accessorRole: user.role,
        actionType: 'view',
        resourceType: 'analytics',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const logs = await dataManagementService.getUserAccessLogs(userId, parseInt(limit as string));
      res.json(logs);
    } catch (error) {
      console.error("Error fetching user access logs:", error);
      res.status(500).json({ message: "Failed to fetch access logs" });
    }
  });

  // Device management endpoints for master admin - temporarily removed for debugging

  // Register social media routes
  registerSocialRoutes(app);

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
  
  // Register contractor signup routes
  app.use(contractorSignupRouter);

  return httpServer;
}