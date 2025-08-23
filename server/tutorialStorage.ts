import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "./db";
import {
  userTutorialProgress,
  tutorialDefinitions,
  tutorialAnalytics,
  type UserTutorialProgress,
  type TutorialDefinition,
  type TutorialAnalytics,
  type InsertUserTutorialProgress,
  type InsertTutorialDefinition,
  type InsertTutorialAnalytics,
  type TutorialConfig,
  type TutorialStep,
} from "@shared/tutorial-schema";

export class TutorialStorageService {
  // User Tutorial Progress Methods
  async getUserTutorialProgress(userId: string): Promise<UserTutorialProgress[]> {
    return await db
      .select()
      .from(userTutorialProgress)
      .where(eq(userTutorialProgress.userId, userId))
      .orderBy(desc(userTutorialProgress.lastActiveAt));
  }

  async getUserSpecificTutorialProgress(
    userId: string,
    tutorialId: string
  ): Promise<UserTutorialProgress | null> {
    const [progress] = await db
      .select()
      .from(userTutorialProgress)
      .where(
        and(
          eq(userTutorialProgress.userId, userId),
          eq(userTutorialProgress.tutorialId, tutorialId)
        )
      );
    return progress || null;
  }

  async createOrUpdateTutorialProgress(
    data: InsertUserTutorialProgress
  ): Promise<UserTutorialProgress> {
    const existing = await this.getUserSpecificTutorialProgress(
      data.userId,
      data.tutorialId
    );

    if (existing) {
      const [updated] = await db
        .update(userTutorialProgress)
        .set({
          ...data,
          updatedAt: new Date(),
          lastActiveAt: new Date(),
        })
        .where(eq(userTutorialProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userTutorialProgress)
        .values(data)
        .returning();
      return created;
    }
  }

  async markTutorialCompleted(
    userId: string,
    tutorialId: string,
    stepIndex?: string
  ): Promise<UserTutorialProgress> {
    return this.createOrUpdateTutorialProgress({
      userId,
      tutorialId,
      tutorialType: "feature",
      stepIndex: stepIndex || "completed",
      isCompleted: true,
      completedAt: new Date(),
    });
  }

  async markTutorialSkipped(
    userId: string,
    tutorialId: string
  ): Promise<UserTutorialProgress> {
    return this.createOrUpdateTutorialProgress({
      userId,
      tutorialId,
      tutorialType: "feature",
      stepIndex: "skipped",
      isSkipped: true,
      completedAt: new Date(),
    });
  }

  // Tutorial Definition Methods
  async getAllActiveTutorials(): Promise<TutorialDefinition[]> {
    return await db
      .select()
      .from(tutorialDefinitions)
      .where(eq(tutorialDefinitions.isActive, true))
      .orderBy(asc(tutorialDefinitions.priority));
  }

  async getTutorialsByRole(role: string): Promise<TutorialDefinition[]> {
    return await db
      .select()
      .from(tutorialDefinitions)
      .where(
        and(
          eq(tutorialDefinitions.isActive, true),
          eq(tutorialDefinitions.targetRole, role)
        )
      )
      .orderBy(asc(tutorialDefinitions.priority));
  }

  async getTutorialsByTrigger(trigger: string): Promise<TutorialDefinition[]> {
    return await db
      .select()
      .from(tutorialDefinitions)
      .where(
        and(
          eq(tutorialDefinitions.isActive, true),
          eq(tutorialDefinitions.triggerCondition, trigger)
        )
      )
      .orderBy(asc(tutorialDefinitions.priority));
  }

  async getTutorialById(id: string): Promise<TutorialDefinition | null> {
    const [tutorial] = await db
      .select()
      .from(tutorialDefinitions)
      .where(eq(tutorialDefinitions.id, id));
    return tutorial || null;
  }

  async createTutorial(data: InsertTutorialDefinition): Promise<TutorialDefinition> {
    const [tutorial] = await db
      .insert(tutorialDefinitions)
      .values({
        ...data,
        steps: data.steps as any // Type assertion to handle array conversion
      })
      .returning();
    return tutorial;
  }

  async updateTutorial(
    id: string,
    data: Partial<InsertTutorialDefinition>
  ): Promise<TutorialDefinition> {
    const updateData = { ...data, updatedAt: new Date() };
    if (data.steps) {
      updateData.steps = data.steps as any; // Type assertion for steps array
    }
    const [tutorial] = await db
      .update(tutorialDefinitions)
      .set(updateData)
      .where(eq(tutorialDefinitions.id, id))
      .returning();
    return tutorial;
  }

  // Analytics Methods
  async recordTutorialAnalytics(data: InsertTutorialAnalytics): Promise<TutorialAnalytics> {
    const [analytics] = await db
      .insert(tutorialAnalytics)
      .values(data)
      .returning();
    return analytics;
  }

  async getTutorialAnalytics(tutorialId: string): Promise<TutorialAnalytics[]> {
    return await db
      .select()
      .from(tutorialAnalytics)
      .where(eq(tutorialAnalytics.tutorialId, tutorialId))
      .orderBy(desc(tutorialAnalytics.timestamp));
  }

  // Helper Methods
  async getRecommendedTutorialsForUser(
    userId: string,
    userRole: string
  ): Promise<{
    onboarding: TutorialDefinition[];
    feature: TutorialDefinition[];
    suggested: TutorialDefinition[];
  }> {
    const completedTutorials = await this.getUserTutorialProgress(userId);
    const completedIds = completedTutorials
      .filter(p => p.isCompleted || p.isSkipped)
      .map(p => p.tutorialId);

    const allTutorials = await this.getTutorialsByRole(userRole);
    const availableTutorials = allTutorials.filter(
      t => !completedIds.includes(t.id)
    );

    const onboarding = availableTutorials.filter(
      t => t.type === "onboarding"
    );
    const feature = availableTutorials.filter(
      t => t.type === "feature"
    );
    const suggested = availableTutorials.filter(
      t => t.priority === "high"
    );

    return { onboarding, feature, suggested };
  }

  async shouldShowTutorial(
    userId: string,
    tutorialId: string
  ): Promise<boolean> {
    const progress = await this.getUserSpecificTutorialProgress(userId, tutorialId);
    return !progress || (!progress.isCompleted && !progress.isSkipped);
  }

  // Predefined tutorial configurations
  async initializeDefaultTutorials(): Promise<void> {
    const defaultTutorials: TutorialConfig[] = [
      {
        id: "onboarding-homeowner",
        name: "Welcome to TradeScout",
        description: "Learn how to find and connect with trusted contractors",
        type: "onboarding",
        targetRole: "homeowner",
        triggerCondition: "account_creation",
        priority: "high",
        steps: [
          {
            id: "welcome",
            title: "Welcome to TradeScout!",
            content: "Let's take a quick tour of your new contractor discovery platform. We'll show you how to find trusted local contractors and get the best deals on your home improvement projects.",
            position: "center",
            action: "highlight",
            skipable: true,
          },
          {
            id: "dashboard",
            title: "Your Dashboard",
            content: "This is your personal dashboard where you can see saved contractors, project estimates, and recent activity. Everything you need is just a click away.",
            targetElement: "[data-tutorial='dashboard']",
            position: "bottom",
            action: "highlight",
            skipable: true,
          },
          {
            id: "search",
            title: "Find Contractors",
            content: "Use the search feature to find contractors by location, specialty, or project type. We'll show you verified professionals in your area.",
            targetElement: "[data-tutorial='search']",
            position: "bottom",
            action: "highlight",
            skipable: true,
          },
          {
            id: "county-map",
            title: "Explore Your County",
            content: "Click on your county to see local contractor activity, Facebook groups, and community discussions about home improvement projects.",
            targetElement: "[data-tutorial='county-map']",
            position: "top",
            action: "highlight",
            skipable: true,
          },
        ],
      },
      {
        id: "onboarding-contractor",
        name: "Contractor Platform Tour",
        description: "Learn how to maximize your business with TradeScout",
        type: "onboarding",
        targetRole: "contractor_user",
        triggerCondition: "account_creation",
        priority: "high",
        steps: [
          {
            id: "welcome",
            title: "Welcome to TradeScout Business!",
            content: "Ready to grow your contracting business? We'll show you how to get more leads, manage your profile, and connect with homeowners in your area.",
            position: "center",
            action: "highlight",
            skipable: true,
          },
          {
            id: "profile",
            title: "Your Professional Profile",
            content: "This is your business profile where customers can learn about your services, see your ratings, and contact you. Keep it updated to attract more clients.",
            targetElement: "[data-tutorial='contractor-profile']",
            position: "bottom",
            action: "highlight",
            skipable: true,
          },
          {
            id: "leads",
            title: "Lead Management",
            content: "Here you can see incoming leads, respond to customer inquiries, and track your active projects. Quick responses lead to more business!",
            targetElement: "[data-tutorial='leads']",
            position: "bottom",
            action: "highlight",
            skipable: true,
          },
          {
            id: "verification",
            title: "Verification Benefits",
            content: "Get verified to build trust with customers and stand out from the competition. Verified contractors get priority placement in search results.",
            targetElement: "[data-tutorial='verification']",
            position: "top",
            action: "highlight",
            skipable: true,
          },
        ],
      },
      {
        id: "feature-estimate-calculator",
        name: "Estimate Calculator",
        description: "Learn how to use the estimate calculator for project pricing",
        type: "feature",
        targetRole: "all",
        triggerCondition: "first_visit",
        priority: "medium",
        steps: [
          {
            id: "intro",
            title: "Project Estimate Calculator",
            content: "Get instant pricing estimates for your home improvement projects based on local market data and material costs.",
            targetElement: "[data-tutorial='estimate-calculator']",
            position: "top",
            action: "highlight",
            skipable: true,
          },
          {
            id: "select-project",
            title: "Select Your Project",
            content: "Choose the type of project you're planning. Our calculator has pricing data for hundreds of common home improvement tasks.",
            targetElement: "[data-tutorial='project-selector']",
            position: "bottom",
            action: "click",
            skipable: true,
          },
          {
            id: "customize",
            title: "Customize Details",
            content: "Add specific details about your project like size, materials, and complexity to get the most accurate estimate.",
            targetElement: "[data-tutorial='project-details']",
            position: "right",
            action: "highlight",
            skipable: true,
          },
        ],
      },
      {
        id: "feature-navigation-customization",
        name: "Customize Your Navigation",
        description: "Learn how to personalize your navigation menu",
        type: "feature",
        targetRole: "all",
        triggerCondition: "first_visit",
        priority: "low",
        steps: [
          {
            id: "intro",
            title: "Personalize Your Navigation",
            content: "Did you know you can customize your navigation menu? Drag items to reorder them and hide features you don't use.",
            targetElement: "[data-tutorial='navigation-preferences']",
            position: "bottom",
            action: "highlight",
            skipable: true,
          },
          {
            id: "drag-drop",
            title: "Drag and Drop",
            content: "Simply drag navigation items up or down to reorder them. Put your most-used features at the top for easy access.",
            targetElement: "[data-tutorial='drag-handle']",
            position: "right",
            action: "highlight",
            skipable: true,
          },
          {
            id: "visibility",
            title: "Show or Hide Items",
            content: "Click the eye icon to hide navigation items you don't need. This helps declutter your interface and focus on what matters to you.",
            targetElement: "[data-tutorial='visibility-toggle']",
            position: "left",
            action: "highlight",
            skipable: true,
          },
        ],
      },
    ];

    for (const tutorial of defaultTutorials) {
      try {
        const existing = await this.getTutorialById(tutorial.id);
        if (!existing) {
        await this.createTutorial({
          id: tutorial.id,
          name: tutorial.name,
          description: tutorial.description,
          type: tutorial.type,
          targetRole: tutorial.targetRole,
          triggerCondition: tutorial.triggerCondition,
          priority: tutorial.priority,
          steps: tutorial.steps,
          isActive: true,
        });
        }
      } catch (error: any) {
        console.log('Database not available for tutorial initialization:', error?.message || 'Unknown error');
        break; // Exit the loop if database is not available
      }
    }
  }
}

export const tutorialStorage = new TutorialStorageService();