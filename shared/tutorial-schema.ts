import { pgTable, varchar, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tutorial progress tracking for users
export const userTutorialProgress = pgTable(
  "user_tutorial_progress",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id").notNull(),
    tutorialType: varchar("tutorial_type").notNull(), // 'onboarding', 'feature'
    tutorialId: varchar("tutorial_id").notNull(), // specific tutorial identifier
    stepIndex: varchar("step_index").notNull().default("0"), // current step or 'completed'
    isCompleted: boolean("is_completed").notNull().default(false),
    isSkipped: boolean("is_skipped").notNull().default(false),
    completedAt: timestamp("completed_at"),
    lastActiveAt: timestamp("last_active_at").defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, any>>(), // flexible data for tutorial state
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_user_tutorial_progress_user_id").on(table.userId),
    index("idx_user_tutorial_progress_tutorial_type").on(table.tutorialType),
    index("idx_user_tutorial_progress_tutorial_id").on(table.tutorialId),
  ]
);

// Tutorial definitions and content
export const tutorialDefinitions = pgTable(
  "tutorial_definitions",
  {
    id: varchar("id").primaryKey(),
    name: varchar("name").notNull(),
    description: text("description"),
    type: varchar("type").notNull(), // 'onboarding', 'feature'
    targetRole: varchar("target_role"), // 'homeowner', 'contractor_user', 'all', etc.
    triggerCondition: varchar("trigger_condition"), // 'account_creation', 'first_visit', 'feature_access'
    priority: varchar("priority").notNull().default("medium"), // 'high', 'medium', 'low'
    isActive: boolean("is_active").notNull().default(true),
    steps: jsonb("steps").$type<TutorialStep[]>().notNull(),
    metadata: jsonb("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_tutorial_definitions_type").on(table.type),
    index("idx_tutorial_definitions_target_role").on(table.targetRole),
    index("idx_tutorial_definitions_trigger_condition").on(table.triggerCondition),
  ]
);

// Tutorial step definition
export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  targetElement?: string; // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'highlight' | 'click' | 'type' | 'navigate' | 'wait';
  actionTarget?: string; // element to interact with
  actionValue?: string; // value for type actions
  skipable?: boolean;
  autoAdvance?: boolean; // auto-advance after action completion
  delay?: number; // delay before showing step (ms)
  multimedia?: {
    type: 'image' | 'video' | 'gif';
    url: string;
    alt?: string;
  };
}

// Tutorial analytics for improvement
export const tutorialAnalytics = pgTable(
  "tutorial_analytics",
  {
    id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id").notNull(),
    tutorialId: varchar("tutorial_id").notNull(),
    stepId: varchar("step_id").notNull(),
    action: varchar("action").notNull(), // 'started', 'completed', 'skipped', 'abandoned'
    timeSpent: varchar("time_spent"), // duration in seconds
    userAgent: text("user_agent"),
    viewport: varchar("viewport"), // screen resolution
    metadata: jsonb("metadata").$type<Record<string, any>>(),
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => [
    index("idx_tutorial_analytics_user_id").on(table.userId),
    index("idx_tutorial_analytics_tutorial_id").on(table.tutorialId),
    index("idx_tutorial_analytics_action").on(table.action),
  ]
);

// Insert schemas
export const insertUserTutorialProgress = createInsertSchema(userTutorialProgress);
export const insertTutorialDefinition = createInsertSchema(tutorialDefinitions);
export const insertTutorialAnalytics = createInsertSchema(tutorialAnalytics);

// Select types
export type UserTutorialProgress = typeof userTutorialProgress.$inferSelect;
export type TutorialDefinition = typeof tutorialDefinitions.$inferSelect;
export type TutorialAnalytics = typeof tutorialAnalytics.$inferSelect;

// Insert types
export type InsertUserTutorialProgress = z.infer<typeof insertUserTutorialProgress>;
export type InsertTutorialDefinition = z.infer<typeof insertTutorialDefinition>;
export type InsertTutorialAnalytics = z.infer<typeof insertTutorialAnalytics>;

// Tutorial configuration types
export interface TutorialConfig {
  id: string;
  name: string;
  description: string;
  type: 'onboarding' | 'feature';
  targetRole?: string;
  triggerCondition: string;
  priority: 'high' | 'medium' | 'low';
  steps: TutorialStep[];
}

// Tutorial context for React components
export interface TutorialContext {
  isActive: boolean;
  currentTutorial: TutorialDefinition | null;
  currentStep: TutorialStep | null;
  stepIndex: number;
  totalSteps: number;
  canSkip: boolean;
  canGoBack: boolean;
  progress: number; // 0-100 percentage
}