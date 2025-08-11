import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isContractor, isAdmin } from "./auth";

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
  insertAddressVerificationSchema
} from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";
import { randomUUID } from "crypto";
import passport from "passport";
import { LocalityTracker, localityTrackingMiddleware } from "./localityTracking";
import FacebookStrategy from "passport-facebook";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure OAuth strategies
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
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

  // Auth user endpoint - critical for useAuth hook
  app.get('/api/auth/user', async (req: any, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = await storage.getUser(req.user.id);
      res.json({ ...user, passwordHash: undefined });
    } catch (error) {
      console.error("Error fetching authenticated user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // User profile routes
  app.get('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      res.json({ ...user, passwordHash: undefined });
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
      res.json({ ...user, passwordHash: undefined });
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
      res.json({ ...user, passwordHash: undefined });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
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
      
      if (state) {
        // Get counties for specific state
        const { getCountiesForState } = await import("@shared/us-counties-complete");
        const counties = getCountiesForState(state as string);
        res.json(counties);
      } else {
        // Get all counties (fallback for compatibility)
        const { getAllCounties } = await import("@shared/us-counties-complete");
        const counties = getAllCounties();
        res.json(counties);
      }
    } catch (error) {
      console.error("Error fetching counties:", error);
      res.status(500).json({ message: "Failed to fetch counties" });
    }
  });

  // Trades endpoint
  app.get("/api/trades", async (req, res) => {
    try {
      const { category, parent } = req.query;
      const { COMPREHENSIVE_TRADES, getTradesByCategory, getSubTrades, getMainTrades } = await import("@shared/trades-data");
      
      let trades = COMPREHENSIVE_TRADES;
      
      if (category) {
        trades = getTradesByCategory(category as string);
      } else if (parent) {
        trades = getSubTrades(parent as string);
      } else if (req.query.main === 'true') {
        trades = getMainTrades();
      }
      
      res.json(trades);
    } catch (error) {
      console.error("Error fetching trades:", error);
      res.status(500).json({ message: "Failed to fetch trades" });
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

  // Admin heatmap data endpoint
  app.get("/api/admin/heatmap", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
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

  // Lead submission (requires auth)
  app.post("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const leadData = { ...req.body, userId };
      
      // Track quote request with locality context
      await LocalityTracker.trackInteraction('quote_request', req, {
        projectType: leadData.projectType,
        tradeType: leadData.trade,
        quoteAmount: leadData.budget
      });
      
      // Validate lead data
      const validatedLead = insertLeadSchema.parse(leadData);
      
      const lead = await storage.createLead(validatedLead);
      
      // For "top 3" routing, assign to multiple contractors
      if (lead.routingType === 'top3') {
        // Implemented contractor selection using performance-weighted algorithm
        const contractors = await storage.getContractors({
          countyId: lead.countyId,
          tradeIds: [lead.tradeId],
          limit: 3,
        });
        
        const contractorIds = contractors.map(c => c.id);
        await storage.assignLeadToContractors(lead.id, contractorIds);
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
      const userId = req.user.claims.sub;
      const recommendationData = { ...req.body, userId };
      
      // Track rating submission with locality context
      await LocalityTracker.trackInteraction('rating_submit', req, {
        contractorId: recommendationData.contractorId,
        rating: recommendationData.rating,
        projectType: 'recommendation'
      });
      
      const validatedRecommendation = insertRecommendationSchema.parse(recommendationData);
      const recommendation = await storage.createRecommendation(validatedRecommendation);
      
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

  // Contractor dashboard (requires contractor auth)
  app.get("/api/contractor/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
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

  // Chat system routes
  // Conversations
  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      
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
      const contractorId = req.user.claims.sub;
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
      const contractorId = req.user.claims.sub;
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

  // Listings
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
      
      const listing = await storage.createMarketplaceListing({
        ...validatedData,
        sellerId: user.id,
      });
      
      res.status(201).json(listing);
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

  const httpServer = createServer(app);
  return httpServer;
}
