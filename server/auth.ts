import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as FacebookStrategy } from "passport-facebook";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { getRolePermissions, getRoleHierarchyLevel, canUserPerformAction } from "@shared/roles";
import type { UserRole } from "@shared/roles";

// Configure session
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool: pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

// Initialize authentication
export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local strategy for email/password authentication
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        if (!user.password) {
          return done(null, false, { message: 'No password set for this account' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

  // Facebook strategy for social authentication
  console.log('Facebook env check:', !!process.env.FACEBOOK_APP_ID, !!process.env.FACEBOOK_APP_SECRET);
  const facebookAppId = process.env.FACEBOOK_APP_ID;
  const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
  
  if (facebookAppId && facebookAppSecret) {
    console.log('Registering Facebook strategy with App ID:', facebookAppId.substring(0, 4) + '...');
    
    try {
      passport.use('facebook', new FacebookStrategy({
        clientID: facebookAppId,
        clientSecret: facebookAppSecret,
        callbackURL: "/api/auth/facebook/callback",
        profileFields: ['id', 'displayName', 'photos', 'email', 'first_name', 'last_name']
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists with this Facebook ID
        let user = await storage.getUserByFacebookId(profile.id);
        
        if (user) {
          // Update last login and return existing user
          return done(null, user);
        }

        // Check if user exists with same email address
        const email = profile.emails?.[0]?.value;
        if (email) {
          user = await storage.getUserByEmail(email);
          if (user) {
            // Link Facebook account to existing user
            await storage.updateUser(user.id, {
              facebookId: profile.id,
              profileImageUrl: profile.photos?.[0]?.value
            });
            return done(null, user);
          }
        }

        // Create new user from Facebook profile - role will be selected during onboarding
        const newUser = await storage.createUser({
          email: email || `${profile.id}@facebook.local`,
          firstName: profile.name?.givenName || profile.displayName,
          lastName: profile.name?.familyName || '',
          profileImageUrl: profile.photos?.[0]?.value,
          facebookId: profile.id,
          role: null, // Will be set during role selection
          emailVerified: !!email, // Consider Facebook email verified
          onboardingCompleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        return done(null, newUser);
      } catch (error) {
        return done(error);
      }
      }));
      
      console.log('Facebook strategy successfully registered');
    } catch (error) {
      console.error('Error registering Facebook strategy:', error);
    }
  } else {
    console.log('Facebook strategy not registered - missing APP_ID or APP_SECRET');
    console.log('APP_ID present:', !!facebookAppId);
    console.log('APP_SECRET present:', !!facebookAppSecret);
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
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
};

// Enhanced role-based authorization middleware with hierarchy support
export const requireRole = (allowedRoles: UserRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as User;
    const userRole = user.role as UserRole;
    
    if (!userRole) {
      return res.status(403).json({ message: "No role assigned" });
    }

    const userLevel = getRoleHierarchyLevel(userRole);
    const hasPermission = allowedRoles.some(role => {
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
export const requirePermission = (permission: keyof ReturnType<typeof getRolePermissions>): RequestHandler => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user as User;
    const userRole = user.role as UserRole;
    
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
export const isAdmin: RequestHandler = requireRole(['moderator', 'ops_admin', 'super_admin', 'head_admin']);
export const isHeadAdmin: RequestHandler = requireRole(['head_admin']);
export const isSuperAdmin: RequestHandler = requireRole(['super_admin', 'head_admin']);
export const isModerator: RequestHandler = requireRole(['moderator', 'ops_admin', 'super_admin', 'head_admin']);
export const isStaff: RequestHandler = requireRole(['support_agent', 'content_moderator', 'territory_manager', 'contractor_success', 'content_seo', 'analytics_specialist', 'marketing_specialist', 'moderator', 'ops_admin', 'super_admin', 'head_admin']);
export const isContractor: RequestHandler = requireRole(['contractor_user', 'accelerator_member']);
export const isCommunityModerator: RequestHandler = requireRole(['community_moderator', 'community_leader', 'moderator', 'ops_admin', 'super_admin', 'head_admin']);

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Master admin setup function
export async function createMasterAdmin(email: string, password: string, firstName: string, lastName: string): Promise<User> {
  const passwordHash = await hashPassword(password);
  
  return storage.createUser({
    email,
    password: passwordHash,
    firstName,
    lastName,
    role: 'head_admin',
    emailVerified: true,
    addressVerified: true, // Master admin bypasses verification
    onboardingCompleted: true,
  });
}