import { featureFlags } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";

export class FeatureFlagRepository {
  constructor(private readonly database: any = db) {}

  async getFeatureFlags(): Promise<any> {
    return await this.database
      .select()
      .from(featureFlags)
      .orderBy(desc(featureFlags.createdAt));
  }

  async getFeatureFlag(key: string): Promise<any | undefined> {
    const [flag] = await this.database
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, key));
    return flag;
  }

  async createFeatureFlag(flagData: any): Promise<any> {
    const [flag] = await this.database
      .insert(featureFlags)
      .values({
        ...flagData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return flag;
  }

  async updateFeatureFlag(id: string, updates: any): Promise<any> {
    const [flag] = await this.database
      .update(featureFlags)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(featureFlags.id, id))
      .returning();
    return flag;
  }

  async deleteFeatureFlag(id: string): Promise<void> {
    await this.database.delete(featureFlags).where(eq(featureFlags.id, id));
  }

  async isFeatureEnabled(key: string, userRole?: string): Promise<boolean> {
    const flag = await this.getFeatureFlag(key);
    if (!flag || !flag.enabled) return false;
    if (userRole && flag.userRoles && flag.userRoles.length > 0) {
      return flag.userRoles.includes(userRole);
    }
    return flag.enabled;
  }
}
