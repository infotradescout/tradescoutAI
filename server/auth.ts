import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { getRolePermissions, getRoleHierarchyLevel, canUserPerformAction } from "@shared/roles";
import type { UserRole } from "@shared/roles";

// Configure session
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
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

        if (!user.passwordHash) {
          return done(null, false, { message: 'No password set for this account' });
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

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
    passwordHash,
    firstName,
    lastName,
    role: 'head_admin',
    emailVerified: true,
    addressVerified: true, // Master admin bypasses verification
    onboardingCompleted: true,
  });
}