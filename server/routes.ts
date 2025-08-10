import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isContractor, isAdmin } from "./auth";
import { insertLeadSchema, insertRecommendationSchema, insertGrowthPackDownloadSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import passport from "passport";
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

  // Counties endpoint
  app.get("/api/counties", async (req, res) => {
    try {
      const { state } = req.query;
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
      const { role, phone, address, city, state, zipCode, companyName, businessDescription, licenseNumber, yearsInBusiness, serviceAreas } = req.body;

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
        });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error setting up profile:", error);
      res.status(500).json({ message: "Failed to setup profile" });
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

  // Lead submission (requires auth)
  app.post("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const leadData = { ...req.body, userId };
      
      // Validate lead data
      const validatedLead = insertLeadSchema.parse(leadData);
      
      const lead = await storage.createLead(validatedLead);
      
      // For "top 3" routing, assign to multiple contractors
      if (lead.routingType === 'top3') {
        // TODO: Implement contractor selection algorithm
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

  // Growth Pack download (no auth required initially)
  app.post("/api/growth-pack", async (req, res) => {
    try {
      const downloadToken = randomUUID();
      const downloadData = { ...req.body, downloadToken };
      
      const validatedDownload = insertGrowthPackDownloadSchema.parse(downloadData);
      const download = await storage.createGrowthPackDownload(validatedDownload);
      
      await storage.logEvent('growth_pack_requested', {
        email: download.email,
        companyName: download.companyName,
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

      // TODO: Generate actual PDF download or redirect to file
      res.json({ 
        message: "Growth Pack download ready",
        filename: "Trade-Scout-Growth-Pack.pdf" 
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
  app.post("/api/contractors/apply", async (req, res) => {
    try {
      const applicationData = req.body;
      
      // Store application (mock for now)
      const application = {
        id: Date.now().toString(),
        ...applicationData,
        status: 'pending',
        submittedAt: new Date(),
      };
      
      // In production, this would save to database and trigger verification workflow
      console.log('New contractor application:', application);
      
      res.json({ 
        message: "Application submitted successfully",
        applicationId: application.id,
        status: 'pending'
      });
    } catch (error) {
      console.error("Error submitting contractor application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  // Accelerator enrollment
  app.post("/api/accelerator/enroll", async (req, res) => {
    try {
      const { planType } = req.body;
      
      // Store enrollment (mock for now)
      const enrollment = {
        id: Date.now().toString(),
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
        suggestedBy: 'homeowner' as const, // This should be determined based on user role
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

  const httpServer = createServer(app);
  return httpServer;
}
