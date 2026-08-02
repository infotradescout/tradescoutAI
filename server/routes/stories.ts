import type { Express } from "express";
import { and, desc, eq } from "drizzle-orm";
import { generatedStories, insertGeneratedStorySchema } from "../../shared/schema";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { storage } from "../storage";
import { StoryGenerationService } from "../story-generation-service";

export function registerStoryRoutes(app: Express): void {
  // Generate a professional story
  app.post("/api/stories/generate", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const { templateId, userInputs } = req.body;

      if (!templateId) {
        return res.status(400).json({ message: "Template ID is required" });
      }

      // Generate story using the service
      const generatedStory = await StoryGenerationService.generateStory({
        templateId,
        userInputs: userInputs || {},
        userId,
      });

      // Track the story generation event
      // LocalityTracker call removed

      res.status(201).json(generatedStory);
    } catch (error: any) {
      console.error("Error generating story:", error);
      res.status(500).json({ message: "Failed to generate story" });
    }
  });

  // Save a generated story
  app.post("/api/stories", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const storyData = { ...req.body, userId };

      // Validate input data
      const parsedStory = insertGeneratedStorySchema.safeParse(storyData);
      if (!parsedStory.success) {
        return res.status(400).json({
          message: "Invalid story payload",
          issues: parsedStory.error.issues,
        });
      }

      const validatedStory = parsedStory.data;

      // Save story to database
      const [savedStory] = await db.insert(generatedStories).values(validatedStory).returning();

      // Log the save event
      await storage.logEvent("story_saved", {
        storyId: savedStory.id,
        userId,
        templateId: savedStory.templateId,
      });

      res.status(201).json(savedStory);
    } catch (error: any) {
      console.error("Error saving story:", error);
      res.status(500).json({ message: "Failed to save story" });
    }
  });

  // Get user's stories
  app.get("/api/stories", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = (req.user as any)?.id || req.user?.claims?.sub;
      const { page = 1, limit = 10, public_only } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause =
        public_only === "true"
          ? and(eq(generatedStories.userId, userId), eq(generatedStories.isPublic, true))
          : eq(generatedStories.userId, userId);

      const stories = await db
        .select()
        .from(generatedStories)
        .where(whereClause)
        .orderBy(desc(generatedStories.createdAt))
        .limit(parseInt(limit))
        .offset(offset);

      res.json(stories);
    } catch (error: any) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });

  // Get story templates
  app.get("/api/stories/templates", async (req: any, res: any) => {
    try {
      const templates = StoryGenerationService.getTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });
}
