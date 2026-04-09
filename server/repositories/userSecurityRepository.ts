import { db } from "../db";
import { trustedDevices, type TrustedDevice } from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";

export class UserSecurityRepository {
  async getUserTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return await db
      .select()
      .from(trustedDevices)
      .where(eq(trustedDevices.userId, userId))
      .orderBy(desc(trustedDevices.lastUsed));
  }

  async removeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    await db
      .delete(trustedDevices)
      .where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.id, deviceId)));
  }
}
