// Server-side type definitions for authentication and API
import type { User as DatabaseUser } from "@shared/schema";

// Extended user type for authenticated requests (includes Replit Auth claims)
export interface AuthenticatedUser extends DatabaseUser {
  claims: {
    sub: string; // Replit user ID
    email: string;
    first_name?: string;
    last_name?: string;
    profile_image_url?: string;
    iat: number;
    exp: number;
  };
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

// Request interface with authenticated user
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  isAuthenticated(): boolean;
}

// Storage method return types
export interface ContractorWithRecommendations {
  contractor: DatabaseUser;
  recommendations: any[];
  ratingSummary: any;
}