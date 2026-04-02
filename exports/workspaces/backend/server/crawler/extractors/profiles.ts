import { db } from "../.././db";

/**
 * Extract public profile data for caching
 */
export async function extractPublicProfiles() {
  try {
    const users = await db.query.users.findMany({
      // No 'verified' property in users table; remove filter
      limit: 5000,
    });

    const safeProfiles = users.map((u: any) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      role: u.role,
      city: u.city,
      state: u.state,
      // verified: u.verified, // removed, not in schema
      createdAt: u.createdAt,
    }));

    return safeProfiles;
  } catch (error) {
    console.error("Error extracting public profiles:", error);
    return [];
  }
}
