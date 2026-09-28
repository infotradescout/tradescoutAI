import { and, eq } from "drizzle-orm";
import { scoutConversations, users } from "@shared/schema";
import { withoutSavedTaskPreference } from "@shared/scoutSavedTaskPersistence";

// The production and in-memory PostgreSQL Drizzle adapters both expose this
// transaction API, but their transaction types are distinct.
export async function deleteSavedScoutTaskAtomically(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  database: any,
  userId: string,
  taskId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await database.transaction(async (tx: any) => {
    const [user] = await tx
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");

    await tx
      .delete(scoutConversations)
      .where(and(eq(scoutConversations.id, taskId), eq(scoutConversations.userId, userId)));

    const preferences = withoutSavedTaskPreference(user?.preferences, taskId);
    if (preferences) {
      await tx
        .update(users)
        .set({ preferences, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }
  });
}
