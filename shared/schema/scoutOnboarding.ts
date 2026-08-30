import { type AnyPgColumn, index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export function createScoutOnboardingSchema(userId: () => AnyPgColumn) {
  // Replaces the in-memory Map in onboardingService.ts with a persistent table.
  // Sessions expire after 2 hours; cleanup runs on each read and periodically.
  const scoutOnboardingSessions = pgTable(
    "scout_onboarding_sessions",
    {
      sessionId: varchar("session_id", { length: 255 }).primaryKey(),
      userId: varchar("user_id", { length: 255 }).references(userId, {
        onDelete: "cascade",
      }),
      // Stored as JSON strings for flexibility without extra columns.
      snapshot: text("snapshot").notNull().default("{}"),
      answeredQuestions: text("answered_questions").notNull().default("[]"),
      skippedQuestions: text("skipped_questions").notNull().default("[]"),
      expirationReason: varchar("expiration_reason", { length: 64 }),
      startedAt: timestamp("started_at").notNull().defaultNow(),
      expiresAt: timestamp("expires_at").notNull(),
      updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (table) => [
      index("idx_scout_onboarding_user_id").on(table.userId),
      index("idx_scout_onboarding_expires_at").on(table.expiresAt),
    ]
  );

  return { scoutOnboardingSessions };
}

type ScoutOnboardingSchema = ReturnType<typeof createScoutOnboardingSchema>;

export type ScoutOnboardingSession =
  ScoutOnboardingSchema["scoutOnboardingSessions"]["$inferSelect"];
export type InsertScoutOnboardingSession =
  ScoutOnboardingSchema["scoutOnboardingSessions"]["$inferInsert"];
