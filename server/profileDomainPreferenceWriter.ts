import { eq } from "drizzle-orm";
import { users } from "@shared/schema";

export type ProfileDomainPreferenceWrite = {
  database: any;
  userId: string;
  preferences: Record<string, unknown>;
};

/**
 * Single persistence boundary for profile-domain preference state. Route code
 * owns the transition; this writer owns only the resulting user-row write.
 */
export async function writeProfileDomainPreferences({
  database,
  userId,
  preferences,
}: ProfileDomainPreferenceWrite): Promise<void> {
  await database
    .update(users)
    .set({ preferences: preferences as any, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
